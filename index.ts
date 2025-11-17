// Request        [MessageType, Id, Method, Params]
// Response       [MessageType, Id, Result]
// Error Response [MessageType, Id, ErrorResult]
// Notification   [MessageType, Method, Params]

const TIMEOUT_CHECK_INTERVAL_MS = 100;

let requestIdCounter = 0;
const generateRequestId = () => (requestIdCounter = (requestIdCounter + 1) >>> 0);

export const enum MessageType {
    Request,
    Notification,
    Response,
    ErrorResponse,
}

type MethodReturnType<Method> = Method extends (...args: any) => infer R ? R : any;

type MethodParameters<Method> = Method extends (...args: infer T) => any ? T : never;

type AnyFunction = (...args: any) => any | Promise<any>;

type KissMethod = string;
type KissRequestId = number;
type KissParams = any[];
type KissError = { code: number, message: string, errorMessage?: string }

type KissRpcOptions = {
    requestTimeout: number,
}

type KissPendingRequest<T> = {
    id: number,
    resolve: (value: MethodReturnType<T>) => void,
    reject: (value: unknown) => void,
    timestamp: number
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
    if (message.length > 4 || message.length < 2) return false;
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

// Shared utility functions
export function parseMessage(raw: string): KissMessage {
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

export function createRequest(method: string, params: any[] | undefined): KissRequest {
    return [MessageType.Request, generateRequestId(), method, params || []];
}

export function createResponse(id: number, data: any): KissResponse {
    return [MessageType.Response, id, data];
}

export function createErrorResponse(id: number, errorCode: number, errorReason: string, errorMessage?: string): KissErrorResponse {
    return [MessageType.ErrorResponse, id, {code: errorCode, message: errorReason, errorMessage: errorMessage}];
}

export function createNotification(method: string, params: any[]): KissNotification {
    return [MessageType.Notification, method, params];
}

// ==================== KissRpc (no appData) ====================

export class DispatcherHandler<Method extends keyof Handlers, Handlers> {
    fn: AnyFunction
    guards: Array<AnyFunction> = []
    method: Method

    constructor(fn: AnyFunction, method: Method) {
        this.fn = fn;
        this.method = method;
    }

    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this {
        this.guards.push(fn);
        return this
    }
}

export class KissRpc<RequestMethods, HandlersMethods = RequestMethods> {
    requestTimeout: number
    toTransport: ((message: string) => void) | null = null;
    dispatcher: Map<KissMethod, DispatcherHandler<any, HandlersMethods>>
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>
    private timeoutCheckInterval: NodeJS.Timeout | null = null

    static parse = parseMessage;
    static createRequest = createRequest;
    static createResponse = createResponse;
    static createErrorResponse = createErrorResponse;
    static createNotification = createNotification;

    constructor(options?: KissRpcOptions) {
        this.requestTimeout = options?.requestTimeout || 5000;
        this.dispatcher = new Map();
        this.pendingRequests = new Map();
    }

    private rejectPendingRequests(error: KissRpcError) {
        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }
        this.pendingRequests.clear();
        this.stopTimeoutChecker();
    }

    private resetDispatcher() {
        for (const handler of this.dispatcher.values()) {
            handler.guards.length = 0;
        }
        this.dispatcher.clear();
    }

    private startTimeoutChecker() {
        if (this.timeoutCheckInterval !== null) return;

        this.timeoutCheckInterval = setInterval(() => {
            const now = Date.now();
            const timedOutRequests: KissRequestId[] = [];

            for (const [id, request] of this.pendingRequests.entries()) {
                if (now - request.timestamp >= this.requestTimeout) {
                    timedOutRequests.push(id);
                }
            }

            for (const id of timedOutRequests) {
                const request = this.pendingRequests.get(id);
                if (request) {
                    this.pendingRequests.delete(id);
                    request.reject(new KissRpcError(
                        KISS_RPC_ERRORS.REQUEST_TIMEOUT.code,
                        KISS_RPC_ERRORS.REQUEST_TIMEOUT.message
                    ));
                }
            }

            if (this.pendingRequests.size === 0) {
                this.stopTimeoutChecker();
            }
        }, TIMEOUT_CHECK_INTERVAL_MS);
    }

    private stopTimeoutChecker() {
        if (this.timeoutCheckInterval !== null) {
            clearInterval(this.timeoutCheckInterval);
            this.timeoutCheckInterval = null;
        }
    }

    registerToTransportCallback(cb: (message: string) => void) {
        this.toTransport = cb;
    }

    registerHandler<Method extends keyof HandlersMethods>(
        method: Method,
        handler: (...params: MethodParameters<HandlersMethods[Method]>) => MethodReturnType<HandlersMethods[Method]> | Promise<MethodReturnType<HandlersMethods[Method]>>,
    ): DispatcherHandler<Method, HandlersMethods> {
        const dispatcherHandler = new DispatcherHandler<Method, HandlersMethods>(handler, method)
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler
    }

    request<Method extends keyof RequestMethods>(
        method: Method,
        params: MethodParameters<RequestMethods[Method]>
    ): Promise<MethodReturnType<RequestMethods[Method]>> {
        const requestMessage = createRequest(method.toString(), params);
        return new Promise<MethodReturnType<RequestMethods[Method]>>((resolve, reject) => {
            this.pendingRequests.set(requestMessage[1], {
                id: requestMessage[1],
                resolve,
                reject,
                timestamp: Date.now()
            });

            if (this.pendingRequests.size === 1) {
                this.startTimeoutChecker();
            }

            this.callToTransport(requestMessage);
        });
    }

    notify<Method extends keyof RequestMethods>(
        method: Method,
        params: MethodParameters<RequestMethods[Method]>
    ): void {
        this.callToTransport(createNotification(method.toString(), params));
    }

    callToTransport(message: KissMessage) {
        if (!this.toTransport) return;
        this.toTransport(JSON.stringify(message));
    }

    handleMessage(message: KissMessage) {
        const messageType = message[0];
        const messageId = (messageType === MessageType.Request ||
                          messageType === MessageType.Response ||
                          messageType === MessageType.ErrorResponse) ? message[1] as number : -1;
        const isNotif = messageType === MessageType.Notification;

        switch (messageType) {
            case MessageType.Request:
            case MessageType.Notification:
                const method = messageType === MessageType.Request ? message[2] : message[1];
                const handler = this.dispatcher.get(method as string);

                if (!handler)
                    return this.callToTransport(createErrorResponse(
                        messageId,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.code,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.message
                    ));

                const params = messageType === MessageType.Request ? message[3] : message[2];

                // Execute guards
                const guardsLength = handler.guards.length;
                try {
                    for (let i = 0; i < guardsLength; i++) {
                        handler.guards[i].apply(null, params);
                    }
                } catch (e) {
                    const err = e as Error
                    if (isNotif) return

                    return this.callToTransport(createErrorResponse(
                        messageId,
                        KISS_RPC_ERRORS.GUARD_ERROR.code,
                        KISS_RPC_ERRORS.GUARD_ERROR.message,
                        err.toString()
                    ));
                }

                // Execute handler
                try {
                    const result = handler.fn.apply(null, params);

                    if (isNotif) return;

                    if (result && result.then) {
                        result.then((res: any) => {
                            this.callToTransport(createResponse(messageId, res));
                        }).catch((e: Error) => {
                            this.callToTransport(createErrorResponse(
                                messageId,
                                KISS_RPC_ERRORS.APPLICATION_ERROR.code,
                                KISS_RPC_ERRORS.APPLICATION_ERROR.message,
                                e.message
                            ));
                        })
                    } else {
                        this.callToTransport(createResponse(messageId, result));
                    }
                } catch (e) {
                    const err = e as Error
                    if (isNotif) return;

                    this.callToTransport(createErrorResponse(
                        messageId,
                        KISS_RPC_ERRORS.APPLICATION_ERROR.code,
                        KISS_RPC_ERRORS.APPLICATION_ERROR.message,
                        err.message
                    ));
                }
                break;
            case MessageType.Response:
            case MessageType.ErrorResponse:
                const pendingRequest = this.pendingRequests.get(messageId);
                if (pendingRequest) {
                    this.pendingRequests.delete(messageId);
                    if (messageType === MessageType.Response) {
                        pendingRequest.resolve(message[2]);
                    } else {
                        const error = message[2];
                        pendingRequest.reject(
                            new KissRpcError(
                                error.code,
                                error.message,
                                messageId,
                                error.errorMessage
                            )
                        )
                    }
                }
        }
    }

    fromTransport(rawMessage: string) {
        let message: KissMessage;
        try {
            message = parseMessage(rawMessage);
            this.handleMessage(message);
        } catch (e) {
            if (e instanceof KissRpcError) {
                this.callToTransport(
                    createErrorResponse(
                        -1,
                        e.code,
                        e.message,
                        e.errorMessage || ''
                    ));
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
        this.stopTimeoutChecker();
        this.toTransport = null;
    }
}

// ==================== KissRpcWithAppData ====================

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

type AppendAppData<I, T extends unknown[]> = [...args: T, appData: I];

type GuardFn<Method extends keyof Handlers, Handlers, AppDataType> =
    (...args: [...MethodParameters<Handlers[Method]>, AppDataType]) => void;

export class DispatcherHandlerWithAppData<Method extends keyof Handlers, Handlers, AppDataType> {
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

export class KissRpcWithAppData<AppDataType, RequestMethods, HandlersMethods = RequestMethods> {
    requestTimeout: number
    toTransport: ((message: string, appData: AppDataType) => void) | null = null;
    dispatcher: Map<KissMethod, DispatcherHandlerWithAppData<any, HandlersMethods, AppDataType>>
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>
    private timeoutCheckInterval: NodeJS.Timeout | null = null

    static parse = parseMessage;
    static createRequest = createRequest;
    static createResponse = createResponse;
    static createErrorResponse = createErrorResponse;
    static createNotification = createNotification;

    constructor(options?: KissRpcOptions) {
        this.requestTimeout = options?.requestTimeout || 5000;
        this.dispatcher = new Map();
        this.pendingRequests = new Map();
    }

    private rejectPendingRequests(error: KissRpcError) {
        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }
        this.pendingRequests.clear();
        this.stopTimeoutChecker();
    }

    private resetDispatcher() {
        for (const handler of this.dispatcher.values()) {
            handler.guards.length = 0;
        }
        this.dispatcher.clear();
    }

    private startTimeoutChecker() {
        if (this.timeoutCheckInterval !== null) return;

        this.timeoutCheckInterval = setInterval(() => {
            const now = Date.now();
            const timedOutRequests: KissRequestId[] = [];

            for (const [id, request] of this.pendingRequests.entries()) {
                if (now - request.timestamp >= this.requestTimeout) {
                    timedOutRequests.push(id);
                }
            }

            for (const id of timedOutRequests) {
                const request = this.pendingRequests.get(id);
                if (request) {
                    this.pendingRequests.delete(id);
                    request.reject(new KissRpcError(
                        KISS_RPC_ERRORS.REQUEST_TIMEOUT.code,
                        KISS_RPC_ERRORS.REQUEST_TIMEOUT.message
                    ));
                }
            }

            if (this.pendingRequests.size === 0) {
                this.stopTimeoutChecker();
            }
        }, TIMEOUT_CHECK_INTERVAL_MS);
    }

    private stopTimeoutChecker() {
        if (this.timeoutCheckInterval !== null) {
            clearInterval(this.timeoutCheckInterval);
            this.timeoutCheckInterval = null;
        }
    }

    registerToTransportCallback(cb: (message: string, appData: AppDataType) => void) {
        this.toTransport = cb;
    }

    registerHandler<Method extends keyof HandlersMethods>(
        method: Method,
        handler: (
            ...params: AppendAppData<AppDataType, MethodParameters<HandlersMethods[Method]>>
        ) => MethodReturnType<HandlersMethods[Method]> | Promise<MethodReturnType<HandlersMethods[Method]>>,
    ): DispatcherHandlerWithAppData<Method, HandlersMethods, AppDataType> {
        const dispatcherHandler = new DispatcherHandlerWithAppData<Method, HandlersMethods, AppDataType>(handler, method)
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler
    }

    request<Method extends keyof RequestMethods>(
        method: Method,
        params: MethodParameters<RequestMethods[Method]>,
        appData: AppDataType
    ): Promise<MethodReturnType<RequestMethods[Method]>> {
        const requestMessage = createRequest(method.toString(), params);
        return new Promise<MethodReturnType<RequestMethods[Method]>>((resolve, reject) => {
            this.pendingRequests.set(requestMessage[1], {
                id: requestMessage[1],
                resolve,
                reject,
                timestamp: Date.now()
            });

            if (this.pendingRequests.size === 1) {
                this.startTimeoutChecker();
            }

            this.callToTransport(requestMessage, appData);
        });
    }

    notify<Method extends keyof RequestMethods>(
        method: Method,
        params: MethodParameters<RequestMethods[Method]>,
        appData: AppDataType
    ): void {
        this.callToTransport(createNotification(method.toString(), params), appData);
    }

    callToTransport(message: KissMessage, appData: AppDataType) {
        if (!this.toTransport) return;
        this.toTransport(JSON.stringify(message), appData);
    }

    handleMessage(message: KissMessage, appData: AppDataType) {
        const messageType = message[0];
        const messageId = (messageType === MessageType.Request ||
                          messageType === MessageType.Response ||
                          messageType === MessageType.ErrorResponse) ? message[1] as number : -1;
        const isNotif = messageType === MessageType.Notification;

        switch (messageType) {
            case MessageType.Request:
            case MessageType.Notification:
                const method = messageType === MessageType.Request ? message[2] : message[1];
                const handler = this.dispatcher.get(method as string);

                if (!handler)
                    return this.callToTransport(createErrorResponse(
                        messageId,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.code,
                        KISS_RPC_ERRORS.METHOD_NOT_FOUND.message
                    ), appData);

                const params = messageType === MessageType.Request ? (message[3] || []) : message[2];

                // Create params with appData once - reuse for guards and handler
                const paramsLength = params.length;
                const paramsWithAppData = new Array(paramsLength + 1);
                for (let i = 0; i < paramsLength; i++) {
                    paramsWithAppData[i] = params[i];
                }
                paramsWithAppData[paramsLength] = appData;

                // Execute guards
                const guardsLength = handler.guards.length;
                try {
                    for (let i = 0; i < guardsLength; i++) {
                        const guard = handler.guards[i];
                        switch (guard.type) {
                            case GuardType.Guard:
                                guard.fn.apply(null, paramsWithAppData);
                                break;
                            case GuardType.ParamGuard:
                                guard.fn.apply(null, params);
                                break;
                            case GuardType.AppData:
                                guard.fn.call(null, appData);
                                break;
                        }
                    }
                } catch (e) {
                    const err = e as Error
                    if (isNotif) return

                    return this.callToTransport(createErrorResponse(
                        messageId,
                        KISS_RPC_ERRORS.GUARD_ERROR.code,
                        KISS_RPC_ERRORS.GUARD_ERROR.message,
                        err.toString()
                    ), appData);
                }

                // Execute handler (reusing paramsWithAppData from above)
                try {
                    const result = handler.fn.apply(null, paramsWithAppData);

                    if (isNotif) return;

                    if (result && result.then) {
                        result.then((res: any) => {
                            this.callToTransport(createResponse(messageId, res), appData);
                        }).catch((e: Error) => {
                            this.callToTransport(createErrorResponse(
                                messageId,
                                KISS_RPC_ERRORS.APPLICATION_ERROR.code,
                                KISS_RPC_ERRORS.APPLICATION_ERROR.message,
                                e.message
                            ), appData);
                        })
                    } else {
                        this.callToTransport(createResponse(messageId, result), appData);
                    }
                } catch (e) {
                    const err = e as Error
                    if (isNotif) return;

                    this.callToTransport(createErrorResponse(
                        messageId,
                        KISS_RPC_ERRORS.APPLICATION_ERROR.code,
                        KISS_RPC_ERRORS.APPLICATION_ERROR.message,
                        err.message
                    ), appData);
                }
                break;
            case MessageType.Response:
            case MessageType.ErrorResponse:
                const pendingRequest = this.pendingRequests.get(messageId);
                if (pendingRequest) {
                    this.pendingRequests.delete(messageId);
                    if (messageType === MessageType.Response) {
                        pendingRequest.resolve(message[2]);
                    } else {
                        const error = message[2];
                        pendingRequest.reject(
                            new KissRpcError(
                                error.code,
                                error.message,
                                messageId,
                                error.errorMessage
                            )
                        )
                    }
                }
        }
    }

    fromTransport(rawMessage: string, appData: AppDataType) {
        let message: KissMessage;
        try {
            message = parseMessage(rawMessage);
            this.handleMessage(message, appData);
        } catch (e) {
            if (e instanceof KissRpcError) {
                this.callToTransport(
                    createErrorResponse(
                        -1,
                        e.code,
                        e.message,
                        e.errorMessage || ''
                    ),
                    appData);
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
        this.stopTimeoutChecker();
        this.toTransport = null;
    }
}
