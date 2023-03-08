// Request        [MessageType, Id, Method, Params]
// Response       [MessageType, Id, Result]
// Error Response [MessageType, Id, ErrorResult]
// Notification   [MessageType, Method, Params]

const generateRandomNumber = function () {
    return Math.round(Math.random() * 10000000);
};

export const enum MessageType {
    Request,
    Notification,
    Response,
    ErrorResponse,
}

type MethodReturnType<Method> = Method extends (...args: any) => infer R ? R : any;

type MethodParameters<Method> = Method extends (...args: infer T) => any ? T : never;

type ToTransportCb<AppDataType> = AppDataType extends undefined ?
    (message: string) => void :
    (message: string, appData: AppDataType) => void;

type FromTransportParams<AppDataType> = AppDataType extends undefined ?
    [message: string] :
    [message: string, appData: AppDataType];

type AppendAppData<I, T extends unknown[]> = [...args: T, appData: I];

type AnyFunction = (...args: any) => any | Promise<any>;

type GuardFn<Method extends keyof Handlers, Handlers, AppDataType> =
    AppDataType extends undefined
        ? (...args: MethodParameters<Handlers[Method]>) => void
        : (...args: [...MethodParameters<Handlers[Method]>, AppDataType]) => void;

type KissMethod = string;
type KissRequestId = number;
type KissParams = any[];
type KissError = { code: number, message: string, errorMessage?: string }

const enum GuardType {
    Guard,
    ParamGuard,
    AppData
}

type Guards = {
    type: GuardType.Guard
    fn: AnyFunction
} | {
    type: GuardType.ParamGuard
    fn: AnyFunction
} | {
    type: GuardType.AppData
    fn: AnyFunction
}

type KissRpcOptions = {
    requestTimeout: number,
}

type KissPendingRequest<T> = {
    id: number,
    resolve: (value: MethodReturnType<T>) => void,
    reject: (value: unknown) => void
}

export type KissRequest = [MessageType.Request, KissRequestId, KissMethod, KissParams];
export type KissResponse = [MessageType.Response, KissRequestId, any];
export type KissNotification = [MessageType.Notification, KissMethod, KissParams];
export type KissErrorResponse = [MessageType.ErrorResponse, KissRequestId, KissError];

export type KissMessage = KissRequest | KissResponse | KissNotification | KissErrorResponse;

export function getMessageType(message: KissMessage): MessageType {
    return message[0];
}

export function getMessageMethod(message: KissMessage): KissMethod {
    switch (getMessageType(message)) {
        case MessageType.Request:
            return message[2];
        case MessageType.Notification:
            return <string>message[1];
        case MessageType.Response:
        case MessageType.ErrorResponse:
            return ''
    }
}

export function getMessageParams(message: KissMessage): KissParams {
    switch (getMessageType(message)) {
        case MessageType.Request:
            return message[3] || [];
        case MessageType.Notification:
            return message[2];
        default:
            return [];
    }
}

export function getMessageId(message: KissMessage): KissRequestId {
    switch (getMessageType(message)) {
        case MessageType.Request:
        case MessageType.Response:
        case MessageType.ErrorResponse:
            return <number>message[1];
        case MessageType.Notification:
            return -1;
    }
}

export function getMessageResult(message: KissMessage): any {
    switch (getMessageType(message)) {
        case MessageType.Response:
            return message[2];
        case MessageType.ErrorResponse:
            return message[2];
        default:
            return;
    }
}

export function getMessageError(message: KissMessage): KissError {
    switch (getMessageType(message)) {
        case MessageType.ErrorResponse:
            return message[2];
        default:
            return new KissRpcError(0, '');
    }
}

export function isRequest(message: KissMessage): message is KissRequest {
    return getMessageType(message) === MessageType.Request;
}

export function isResponse(message: KissMessage): message is KissResponse {
    return getMessageType(message) === MessageType.Response;
}

export function isErrorResponse(message: KissMessage): message is KissErrorResponse {
    return getMessageType(message) === MessageType.ErrorResponse;
}

export function isNotification(message: KissMessage): message is KissNotification {
    return getMessageType(message) === MessageType.Notification;
}

export function isMessage(message: any): message is KissMessage {
    if (!Array.isArray(message)) return false;
    if (message.length > 4 || message.length < 3) return false;
    if (typeof message[0] !== 'number') return false;
    if (message[0] < 0 || message[0] > 3) return false;

    switch (getMessageType(message as KissMessage)) {
        case MessageType.Request:
            if (typeof message[1] !== 'number') return false;
            if (typeof message[2] !== 'string') return false;
            break;
        case MessageType.Response:
            if (typeof message[1] !== 'number') return false;
            break;
        case MessageType.ErrorResponse:
            if (typeof message[1] !== 'number') return false;
            if (typeof message[2] !== 'object') return false;
            if (typeof message[2].code !== 'number') return false;
            if (typeof message[2].message !== 'string') return false;
            break;
        case MessageType.Notification:
            if (typeof message[1] !== 'string') return false;
            break;
        default:
            return false;
    }
    return true;
}

export class KissRpcError extends Error {
    code: number
    message: string
    id?: number
    errorMessage?: string

    constructor(code: number, message: string, id: number = -1, errorMessage: string = '') {
        super();
        this.code = code;
        this.message = message;
        this.id = id;
        this.errorMessage = errorMessage;
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
    },
    APPLICATION_ERROR: {
        code: 1007,
        message: 'Application error'
    },
    TRANSPORT_ERROR: {
        code: 1008,
        message: 'Underlying transport issue'
    }
};

export class DispatcherHandler<Method extends keyof Handlers, Handlers, AppDataType = undefined> {
    fn: AnyFunction
    guards: Array<Guards> = []
    method: Method

    constructor(fn: AnyFunction, method: Method) {
        this.fn = fn;
        this.method = method;
    }

    addGuard(fn: GuardFn<Method, Handlers, AppDataType>): this {
        this.guards.push({
            type: GuardType.Guard,
            fn
        });
        return this
    }

    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this {
        this.guards.push({
            type: GuardType.ParamGuard,
            fn
        });
        return this
    }

    addAppDataGuard(fn: (appData: AppDataType) => void): this {
        this.guards.push({
            type: GuardType.AppData,
            fn
        });
        return this
    }
}

export class KissRpc<RequestMethods, HandlersMethods = RequestMethods, AppDataType = undefined> {
    requestTimeout: number
    toTransport: ToTransportCb<AppDataType> | null = null;
    dispatcher: Map<KissMethod, DispatcherHandler<any, HandlersMethods, AppDataType>>
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>

    static parse(raw: string): KissMessage {
        let message: KissMessage;
        try {
            message = JSON.parse(raw);
        } catch (error) {
            throw new KissRpcError(
                KISS_RPC_ERRORS.PARSE_ERROR.code,
                KISS_RPC_ERRORS.PARSE_ERROR.message
            );
        }
        if (!isMessage(message)) {
            throw new KissRpcError(
                KISS_RPC_ERRORS.INVALID_REQUEST.code,
                KISS_RPC_ERRORS.INVALID_REQUEST.message
            );
        }
        return message;
    }

    static createRequest(method: string, params: any[] | undefined): KissRequest {
        return [MessageType.Request, generateRandomNumber(), method, params || []];
    }

    static createResponse(id: number, data: any): KissResponse {
        return [MessageType.Response, id, data];
    }

    static createErrorResponse(id: number, errorCode: number, errorReason: string, errorMessage?: string): KissErrorResponse {
        return [MessageType.ErrorResponse, id, {code: errorCode, message: errorReason, errorMessage: errorMessage}];
    }

    static createNotification(method: string, params: any[]): KissNotification {
        return [MessageType.Notification, method, params];
    }

    constructor(options: KissRpcOptions) {
        this.requestTimeout = options.requestTimeout || 5000;
        this.dispatcher = new Map<KissMethod, DispatcherHandler<any, HandlersMethods, AppDataType>>();
        this.pendingRequests = new Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>();
    }

    private appDataIsDefined(appData?: AppDataType): appData is NonNullable<AppDataType> {
        return appData !== undefined && appData !== null;
    }

    private rejectPendingRequests(error: KissRpcError) {
        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }
        this.pendingRequests.clear();
    }

    private resetDispatcher() {
        for (const handler of this.dispatcher.values()) {
            handler.guards.length = 0;
        }
        this.dispatcher.clear();
    }

    registerToTransportCallback(cb: ToTransportCb<AppDataType>) {
        this.toTransport = cb;
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
        const requestMessage = KissRpc.createRequest(args[0].toString(), args[1]);
        return Promise.race([
            new Promise<MethodReturnType<RequestMethods[Method]>>((resolve, reject) => {
                this.pendingRequests.set(requestMessage[1], {
                    id: requestMessage[1],
                    resolve,
                    reject
                });
                this.callToTransport(requestMessage, args[2]);
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
        this.callToTransport(KissRpc.createNotification(args[0].toString(), args[1]), args[2]);
    }

    callToTransport(message: KissMessage, appData?: AppDataType) {
        if (!this.toTransport) return;

        this.appDataIsDefined(appData) ?
            this.toTransport(JSON.stringify(message), appData) :
            // @ts-ignore because we know that appData is undefined
            // and also because we know that toTransport is defined
            // and because fuck you typescript
            this.toTransport(JSON.stringify(message));
    }

    handleMessage(message: KissMessage, appData?: AppDataType) {
        switch (getMessageType(message)) {
            case MessageType.Request:
            case MessageType.Notification:
                const handler = this.dispatcher.get(getMessageMethod(message));
                if (!handler)
                    return this.callToTransport(KissRpc.createErrorResponse(
                        isRequest(message) ? getMessageId(message) : -1,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.code,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.message
                    ), appData);

                // Execute guards attached to the handler
                try {
                    if (handler.guards.length) {
                        for (const guard of handler.guards) {
                            switch (guard.type) {
                                case GuardType.Guard:
                                    guard.fn.apply(
                                        null,
                                        this.appDataIsDefined(appData) ?
                                            [...getMessageParams(message), appData] :
                                            [getMessageParams(message)]);
                                    break;
                                case GuardType.ParamGuard:
                                    guard.fn.apply(null, getMessageParams(message));
                                    break;
                                case GuardType.AppData:
                                    if (this.appDataIsDefined(appData)) {
                                        guard.fn.apply(null, [appData])
                                    }
                                    break;
                            }
                        }
                    }
                } catch (e) {
                    const err = e as Error

                    if (isNotification(message)) return

                    return this.callToTransport(KissRpc.createErrorResponse(
                        getMessageId(message),
                        KISS_RPC_ERRORS.GUARD_ERROR.code,
                        KISS_RPC_ERRORS.GUARD_ERROR.message,
                        err.toString()
                    ), appData);
                }

                // Guard passed, execute handler

                try {
                    let result
                    if (this.appDataIsDefined(appData)) {
                        result = handler.fn.apply(null, [...getMessageParams(message), appData]);
                    } else {
                        result = handler.fn.apply(null, getMessageParams(message));
                    }
                    // Notifications don't have any response
                    if (isNotification(message)) return;

                    if (result.then) {
                        result.then((res: any) => {
                            this.callToTransport(KissRpc.createResponse(getMessageId(message), res), appData);
                        }).catch((e: Error) => {
                            this.callToTransport(KissRpc.createErrorResponse(
                                getMessageId(message),
                                KISS_RPC_ERRORS.APPLICATION_ERROR.code,
                                KISS_RPC_ERRORS.APPLICATION_ERROR.message,
                                e.message
                            ), appData);

                        })
                    } else {
                        this.callToTransport(
                            KissRpc.createResponse(getMessageId(message), result),
                            appData
                        );
                    }
                } catch (e) {
                    const err = e as Error

                    if (isNotification(message)) return;

                    this.callToTransport(KissRpc.createErrorResponse(
                        getMessageId(message),
                        KISS_RPC_ERRORS.APPLICATION_ERROR.code,
                        KISS_RPC_ERRORS.APPLICATION_ERROR.message,
                        err.message
                    ), appData);
                }
                break;
            case MessageType.Response:
            case MessageType.ErrorResponse:
                const pendingRequest = this.pendingRequests.get(getMessageId(message));
                if (pendingRequest) {
                    this.pendingRequests.delete(getMessageId(message));
                    if (isResponse(message)) {
                        pendingRequest.resolve(getMessageResult(message));
                    } else if (isErrorResponse(message)) {
                        const error = getMessageError(message);
                        pendingRequest.reject(
                            new KissRpcError(
                                error.code,
                                error.message,
                                getMessageId(message),
                                error.errorMessage
                            )
                        )
                    }
                }
        }
    }

    fromTransport(...args: FromTransportParams<AppDataType>) {
        let message: KissMessage;
        try {
            message = KissRpc.parse(args[0]);
            // handleMessage will call toTransport if it's defined for any errors,
            // so we don't need to check it here the only thing we care if message
            // was parsed correctly and is valid
            this.appDataIsDefined(args[1]) ?
                this.handleMessage(message, args[1]) :
                this.handleMessage(message)

        } catch (e) {
            if (e instanceof KissRpcError) {
                this.callToTransport(
                    KissRpc.createErrorResponse(
                        -1,
                        e.code,
                        e.message,
                        e.errorMessage || ''
                    ),
                    args[1]);
            }
        }
    }

    clean(reason: string) {
        this.rejectPendingRequests(new KissRpcError(
            KISS_RPC_ERRORS.INTERNAL_ERROR.code,
            KISS_RPC_ERRORS.INTERNAL_ERROR.message,
            -1,
            reason
        ));
        this.resetDispatcher();
        this.toTransport = null;
    }
}
