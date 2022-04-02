// Request
// | MessageType | Id | Method | Params

// Response
// | MessageType | Id | Result

// Error Response
// | MessageType | Id | ErrorResult

// Notification
// | MessageType | Method | Params

const generateRandomNumber = function () {
    return Math.round(Math.random() * 10000000);
};

const isAsync = (fn: Function) => fn.constructor.name === 'AsyncFunction';

enum MessageType {
    Request,
    Notification,
    Response,
    ErrorResponse,
}

type MethodReturnType<Method> = Method extends (...args: any) => infer R
    ? R
    : any;

type MethodParameters<Method> = Method extends (...args: infer T) => any
    ? T
    : never;

type AppendAppData<I, T extends unknown[]> = [...args: T, appData: I]

type AnyFunction = (...args: any) => any | Promise<any>

type KissRequest = [MessageType.Request, number, string, any[]]
type KissResponse = [MessageType.Response, number, any]
type KissNotification = [MessageType.Notification, number, any[]]
type KissErrorResponse = [MessageType.ErrorResponse, number, { code: number, message: string }]

export type KissMessageRaw = KissRequest | KissResponse | KissNotification | KissErrorResponse

export class KissRpcError extends Error {
    code: number;
    message: string;
    id?: number

    constructor(code: number, message: string, id: number = -1) {
        super();
        this.code = code;
        this.message = message;
        this.id = id;
    }
}

export const KISS_RPC_ERRORS = {
    PARSE_ERROR: {
        code: 1000,
        message: "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text."
    },
    INVALID_REQUEST: {
        code: 1001,
        message: "Invalid Request. The JSON sent is not a valid Request object."
    },
    METHOD_NOT_FOUND: {
        code: 1002,
        message: "Method not found. The method does not exist / is not available."
    },
    INTERNAL_ERROR: {
        code: 1004,
        message: "Internal error. Internal JSON-RPC error."
    },
    REQUEST_TIMEOUT: {
        code: 1005,
        message: 'Request has timed-out'
    },
    GUARD_ERROR: {
        code: 1006,
        message: 'Guard error'
    }
};

/*const request = KissRpc.createRequest('login', [1, 23, '2'])

const response = KissRpc.createResponse(123, [{123: 123}])

const errResponse = KissRpc.createErrorResponse(123, 23, 'Some error');

const notification = KissRpc.createNotification('login', [1, 23, '2'])*/

/*const request = [MessageType.Request, 123, 'session.login', [{token: '123'}]];
const response = [MessageType.Response, 123, true];
const errorResponse = [MessageType.ErrorResponse, 123, {code: 123123, text: 'some error'}];
const notification = [MessageType.Notification, 'session.started'];*/

type KissMessage = {
    type: MessageType.Request,
    id: number,
    method: string,
    params: any[],
} | {
    type: MessageType.Notification,
    method: string,
    params: any[],
} | {
    type: MessageType.Response,
    id: number,
    result: any,
} | {
    type: MessageType.ErrorResponse,
    id: number,
    error: {
        code: number,
        message: string
    }
}

type KissRpcOptions = {
    requestTimeout: number,
}

/*type DispatcherHandler = {
    fn: (...args: any) => any | Promise<any>
    isAsync: boolean
}*/

class DispatcherHandler<Method extends keyof Handlers , Handlers, AppDataType = undefined> {
    fn: AnyFunction
    /*    guards: Array<(
            ...params: AppDataType extends undefined ? MethodParameters<Handlers[Method]> : Prepend<AppDataType, MethodParameters<Handlers[Method]>>
        ) => boolean> = []
        paramsGuards: Array<(
            ...params: MethodParameters<Handlers[Method]>
        ) => boolean> = []
        appDataGuards: Array<(
            appData: AppDataType
        ) => boolean> = []*/
    guards: Array<AnyFunction> = []
    paramsGuards: Array<AnyFunction> = []
    appDataGuards: Array<(
        appData: AppDataType
    ) => void> = []
    isAsync: boolean
    method: Method
    constructor(fn: (...args: any) => any | Promise<any>, method: Method) {
        this.fn = fn;
        this.isAsync = isAsync(fn);
        this.method = method;
    }
    addGuard(fn: (
        ...params: AppDataType extends undefined ? MethodParameters<Handlers[Method]> : AppendAppData<AppDataType, MethodParameters<Handlers[Method]>>
    ) => void): this {
        this.guards.push(fn);
        return this
    }
    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this {
        this.paramsGuards.push(fn);
        return this
    }
    addAppDataGuard(fn: (appData: AppDataType) => void): this {
        this.appDataGuards.push(fn);
        return this
    }
}

type KissRpcMethod = string

type KissRequestId = number

type KissPendingRequest<T> = {
    id: number,
    resolve: (value: MethodReturnType<T>) => void,
    reject: (value: unknown) => void
}

export class KissRpc<RequestMethods, HandlersMethods = RequestMethods , AppDataType = undefined> {
    requestTimeout: number
    toTransport: ((...args: AppDataType extends undefined ? [message: string] : [message: string, appData: AppDataType]) => void) | null = null
    dispatcher: Map<KissRpcMethod, DispatcherHandler<any,HandlersMethods, AppDataType>>
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>

    appDataIsDefined(appData: AppDataType | undefined): appData is AppDataType {
        return appData !== undefined;
    }

    rejectPendingRequests(reason: string) {
        for (const request of this.pendingRequests.values()) {
            request.reject(reason);
        }
        this.pendingRequests.clear();
    }

    static parse(raw: string): KissMessage {

        let object;

        try {
            object = JSON.parse(raw);
        } catch (error) {
            throw new KissRpcError(
                KISS_RPC_ERRORS.PARSE_ERROR.code,
                KISS_RPC_ERRORS.PARSE_ERROR.message
            );
        }

        if (!Array.isArray(object)) {
            throw new KissRpcError(
                KISS_RPC_ERRORS.INVALID_REQUEST.code,
                KISS_RPC_ERRORS.INVALID_REQUEST.message
            );
        }

        let message: KissMessage;

        switch (object[0]) {
            case MessageType.Request:
                object = object as KissRequest;
                if (typeof object[2] !== 'string') {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }

                if (typeof object[1] !== 'number') {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }
                return message = {
                    type: MessageType.Request,
                    id: object[1],
                    method: object[2],
                    params: Array.isArray(object[3]) ? object[3] : []
                }
            case MessageType.Response:
                object = object as KissResponse;
                if (typeof object[1] !== 'number') {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }

                return message = {
                    type: MessageType.Response,
                    id: object[1],
                    result: object[2]
                }
            case MessageType.Notification:
                object = object as KissNotification;
                if (typeof object[1] !== 'string') {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }
                return message = {
                    type: MessageType.Notification,
                    method: object[1],
                    params: object[2]
                }
            case MessageType.ErrorResponse:
                object = object as KissErrorResponse;
                if (typeof object[1] !== 'number') {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }
                const err = object[2];

                if (!err || !err.code || !err.message) {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }

                if (typeof err.message !== 'string' || typeof err.code !== 'number') {
                    throw new KissRpcError(
                        KISS_RPC_ERRORS.INVALID_REQUEST.code,
                        KISS_RPC_ERRORS.INVALID_REQUEST.message
                    );
                }

                return message = {
                    type: MessageType.ErrorResponse,
                    id: object[1],
                    error: err
                }
            default:
                throw new KissRpcError(
                    KISS_RPC_ERRORS.INVALID_REQUEST.code,
                    KISS_RPC_ERRORS.INVALID_REQUEST.message
                );
        }
    }

    registerToTransportCallback(cb: (...args: AppDataType extends undefined ? [message: string] : [message: string, appData: AppDataType]) => void
    ) {
        this.toTransport = cb;
    }

    static createRequest(method: string, params: any[]): KissRequest {
        return [MessageType.Request, generateRandomNumber(), method, params];
    }

    static createResponse(id: number, data: any): KissResponse {
        return [MessageType.Response, id, data];
    }

    static createErrorResponse(id: number, errorCode: number, errorReason: string): KissErrorResponse {
        return [MessageType.ErrorResponse, id, {code: errorCode, message: errorReason}];
    }

    static createNotification(method: string, params: any[]) {
        return [MessageType.Notification, method, params];
    }

    constructor(options: KissRpcOptions) {
        this.requestTimeout = options.requestTimeout || 5000;
        this.dispatcher = new Map<KissRpcMethod, DispatcherHandler<any, HandlersMethods, AppDataType>>();
        this.pendingRequests = new Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>();
    }

    registerHandler<Method extends keyof HandlersMethods>(
        method: Method,
        handler: (
            ...params: AppDataType extends undefined ?
                MethodParameters<HandlersMethods[Method]> :
                AppendAppData<AppDataType, MethodParameters<HandlersMethods[Method]>>
        ) => MethodReturnType<HandlersMethods[Method]> | Promise<MethodReturnType<HandlersMethods[Method]>>,
    ): DispatcherHandler<Method, HandlersMethods, AppDataType> {
        const dispatcherHandler = new DispatcherHandler<Method, HandlersMethods, AppDataType>(handler, method)
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler
    }

    request<Method extends keyof RequestMethods>(
        ...args: AppDataType extends undefined ?
            [method: Method, params: MethodParameters<RequestMethods[Method]>] :
            [method: Method, params: MethodParameters<RequestMethods[Method]>, appData: AppDataType]
    ): Promise<MethodReturnType<RequestMethods[Method]>> {
        const [method, params, appData] = args;
        const requestMessage = KissRpc.createRequest(method.toString(), params)
        return Promise.race([
            new Promise<MethodReturnType<RequestMethods[Method]>>((resolve, reject) => {
                this.pendingRequests.set(requestMessage[1], {
                    id: requestMessage[1],
                    resolve,
                    reject
                });
                this.callToTransport(requestMessage, appData);
            }),
            new Promise<never>((resolve, reject) => {
                setTimeout(() => {
                    this.pendingRequests.delete(requestMessage[1])
                    reject(new KissRpcError(
                        KISS_RPC_ERRORS.REQUEST_TIMEOUT.code,
                        KISS_RPC_ERRORS.REQUEST_TIMEOUT.message
                    ))
                }, this.requestTimeout);
            })
        ])
    }

    notify<Method extends keyof RequestMethods>(
        ...args: AppDataType extends undefined ?
            [method: Method, params: MethodParameters<RequestMethods[Method]>] :
            [method: Method, params: MethodParameters<RequestMethods[Method]>, appData: AppDataType]
    ): void {
        const [method, params, appData] = args;
        if (!this.toTransport) return
        // @ts-ignore
        this.toTransport(JSON.stringify(KissRpc.createNotification(method, params)), appData)
    }

    callToTransport(message: KissMessageRaw, appData?: AppDataType) {
        if (!this.toTransport) return
        // @ts-ignore
        this.toTransport(JSON.stringify(message), appData)
    }

    handleMessage(message: KissMessage, appData?: AppDataType) {
        switch (message.type) {
            case MessageType.Request:
            case MessageType.Notification:
                const handler = this.dispatcher.get(message.method);
                if (!handler)
                    return this.callToTransport(KissRpc.createErrorResponse(
                        message.type === MessageType.Request ? message.id : -1,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.code,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.message
                    ))
                try {
                    if (handler.guards.length) {
                        for (const guard of handler.guards) {
                            guard.apply(null, !appData ? message.params : [...message.params, appData])
                        }
                    }
                    if (handler.paramsGuards.length) {
                        for (const guard of handler.paramsGuards) {
                            guard.apply(null, message.params)
                        }
                    }
                    if (handler.appDataGuards.length) {
                        if (this.appDataIsDefined(appData)) {
                            for (const guard of handler.appDataGuards) {
                                guard.apply(null, [appData])
                            }
                        }
                    }

                    let result
                    if (this.appDataIsDefined(appData)) {
                        result = handler.fn.apply(null, [...message.params, appData]);
                    } else {
                        result = handler.fn.apply(null,  message.params);
                    }
                    // Notifications don't have any response
                    if (message.type === MessageType.Notification) return

                    if (handler.isAsync) {
                        result.then((res: any) => {
                            this.callToTransport(KissRpc.createResponse(message.id, res), appData);
                        }).catch(() => {
                            this.callToTransport(KissRpc.createErrorResponse(
                                message.id,
                                KISS_RPC_ERRORS.INTERNAL_ERROR.code,
                                KISS_RPC_ERRORS.INTERNAL_ERROR.message
                            ), appData)
                        })
                    } else {
                        this.callToTransport(
                            KissRpc.createResponse(message.id, result),
                            appData
                        );
                    }
                } catch (e) {
                    if (message.type === MessageType.Notification) return
                    this.callToTransport(KissRpc.createErrorResponse(
                        message.id,
                        KISS_RPC_ERRORS.INTERNAL_ERROR.code,
                        KISS_RPC_ERRORS.INTERNAL_ERROR.message
                    ), appData)
                }
                break;
            case MessageType.Response:
            case MessageType.ErrorResponse:
                const pendingRequest = this.pendingRequests.get(message.id);
                if (pendingRequest) {
                    this.pendingRequests.delete(message.id);
                    if (message.type === MessageType.Response) {
                        pendingRequest.resolve(message.result);
                    } else if (message.type === MessageType.ErrorResponse) {
                        pendingRequest.reject(
                            new KissRpcError(
                                message.error.code,
                                message.error.message,
                                message.id
                            )
                        )
                    }
                }
        }
    }

    fromTransport(message: string, appData?: AppDataType) {
        try {
            const kissMessage = KissRpc.parse(message)
            this.handleMessage(kissMessage, appData)
        } catch (e) {
            if (e instanceof KissRpcError) {
                if (!this.toTransport) return
                // @ts-ignore
                this.toTransport(JSON.stringify(KissRpc.createErrorResponse(kissMessage.id || -1, e.code, e.message)));
            }
        }
    }
}
