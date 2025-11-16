export declare const enum MessageType {
    Request = 0,
    Notification = 1,
    Response = 2,
    ErrorResponse = 3
}
type MethodReturnType<Method> = Method extends (...args: any) => infer R ? R : any;
type MethodParameters<Method> = Method extends (...args: infer T) => any ? T : never;
type AnyFunction = (...args: any) => any | Promise<any>;
type KissMethod = string;
type KissRequestId = number;
type KissParams = any[];
type KissError = {
    code: number;
    message: string;
    errorMessage?: string;
};
type KissRpcOptions = {
    requestTimeout: number;
};
type KissPendingRequest<T> = {
    id: number;
    resolve: (value: MethodReturnType<T>) => void;
    reject: (value: unknown) => void;
    timestamp: number;
};
export type KissRequest = [MessageType.Request, KissRequestId, KissMethod, KissParams];
export type KissResponse = [MessageType.Response, KissRequestId, any];
export type KissNotification = [MessageType.Notification, KissMethod, KissParams];
export type KissErrorResponse = [MessageType.ErrorResponse, KissRequestId, KissError];
export type KissMessage = KissRequest | KissResponse | KissNotification | KissErrorResponse;
export declare function getMessageType(message: KissMessage): MessageType;
export declare function getMessageMethod(message: KissMessage): KissMethod;
export declare function getMessageParams(message: KissMessage): KissParams;
export declare function getMessageId(message: KissMessage): KissRequestId;
export declare function getMessageResult(message: KissMessage): any;
export declare function getMessageError(message: KissMessage): KissError;
export declare function isRequest(message: KissMessage): message is KissRequest;
export declare function isResponse(message: KissMessage): message is KissResponse;
export declare function isErrorResponse(message: KissMessage): message is KissErrorResponse;
export declare function isNotification(message: KissMessage): message is KissNotification;
export declare function isMessage(message: any): message is KissMessage;
export declare class KissRpcError extends Error {
    code: number;
    message: string;
    id?: number;
    errorMessage?: string;
    constructor(code: number, message: string, id?: number, errorMessage?: string);
}
export declare const KISS_RPC_ERRORS: {
    PARSE_ERROR: {
        code: number;
        message: string;
    };
    INVALID_REQUEST: {
        code: number;
        message: string;
    };
    METHOD_NOT_FOUND: {
        code: number;
        message: string;
    };
    INTERNAL_ERROR: {
        code: number;
        message: string;
    };
    REQUEST_TIMEOUT: {
        code: number;
        message: string;
    };
    GUARD_ERROR: {
        code: number;
        message: string;
    };
    APPLICATION_ERROR: {
        code: number;
        message: string;
    };
    TRANSPORT_ERROR: {
        code: number;
        message: string;
    };
};
export declare function parseMessage(raw: string): KissMessage;
export declare function createRequest(method: string, params: any[] | undefined): KissRequest;
export declare function createResponse(id: number, data: any): KissResponse;
export declare function createErrorResponse(id: number, errorCode: number, errorReason: string, errorMessage?: string): KissErrorResponse;
export declare function createNotification(method: string, params: any[]): KissNotification;
export declare class DispatcherHandler<Method extends keyof Handlers, Handlers> {
    fn: AnyFunction;
    guards: Array<AnyFunction>;
    method: Method;
    constructor(fn: AnyFunction, method: Method);
    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this;
}
export declare class KissRpc<RequestMethods, HandlersMethods = RequestMethods> {
    requestTimeout: number;
    toTransport: ((message: string) => void) | null;
    dispatcher: Map<KissMethod, DispatcherHandler<any, HandlersMethods>>;
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>;
    private timeoutCheckInterval;
    static parse: typeof parseMessage;
    static createRequest: typeof createRequest;
    static createResponse: typeof createResponse;
    static createErrorResponse: typeof createErrorResponse;
    static createNotification: typeof createNotification;
    constructor(options?: KissRpcOptions);
    private rejectPendingRequests;
    private resetDispatcher;
    private startTimeoutChecker;
    private stopTimeoutChecker;
    registerToTransportCallback(cb: (message: string) => void): void;
    registerHandler<Method extends keyof HandlersMethods>(method: Method, handler: (...params: MethodParameters<HandlersMethods[Method]>) => MethodReturnType<HandlersMethods[Method]> | Promise<MethodReturnType<HandlersMethods[Method]>>): DispatcherHandler<Method, HandlersMethods>;
    request<Method extends keyof RequestMethods>(method: Method, params: MethodParameters<RequestMethods[Method]>): Promise<MethodReturnType<RequestMethods[Method]>>;
    notify<Method extends keyof RequestMethods>(method: Method, params: MethodParameters<RequestMethods[Method]>): void;
    callToTransport(message: KissMessage): void;
    handleMessage(message: KissMessage): void;
    fromTransport(rawMessage: string): void;
    clean(reason: string): void;
}
declare const enum GuardType {
    Guard = 0,
    ParamGuard = 1,
    AppData = 2
}
type Guards = {
    type: GuardType.Guard;
    fn: AnyFunction;
} | {
    type: GuardType.ParamGuard;
    fn: AnyFunction;
} | {
    type: GuardType.AppData;
    fn: AnyFunction;
};
type AppendAppData<I, T extends unknown[]> = [...args: T, appData: I];
type GuardFn<Method extends keyof Handlers, Handlers, AppDataType> = (...args: [...MethodParameters<Handlers[Method]>, AppDataType]) => void;
export declare class DispatcherHandlerWithAppData<Method extends keyof Handlers, Handlers, AppDataType> {
    fn: AnyFunction;
    guards: Array<Guards>;
    method: Method;
    constructor(fn: AnyFunction, method: Method);
    addGuard(fn: GuardFn<Method, Handlers, AppDataType>): this;
    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this;
    addAppDataGuard(fn: (appData: AppDataType) => void): this;
}
export declare class KissRpcWithAppData<AppDataType, RequestMethods, HandlersMethods = RequestMethods> {
    requestTimeout: number;
    toTransport: ((message: string, appData: AppDataType) => void) | null;
    dispatcher: Map<KissMethod, DispatcherHandlerWithAppData<any, HandlersMethods, AppDataType>>;
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>;
    private timeoutCheckInterval;
    static parse: typeof parseMessage;
    static createRequest: typeof createRequest;
    static createResponse: typeof createResponse;
    static createErrorResponse: typeof createErrorResponse;
    static createNotification: typeof createNotification;
    constructor(options?: KissRpcOptions);
    private rejectPendingRequests;
    private resetDispatcher;
    private startTimeoutChecker;
    private stopTimeoutChecker;
    registerToTransportCallback(cb: (message: string, appData: AppDataType) => void): void;
    registerHandler<Method extends keyof HandlersMethods>(method: Method, handler: (...params: AppendAppData<AppDataType, MethodParameters<HandlersMethods[Method]>>) => MethodReturnType<HandlersMethods[Method]> | Promise<MethodReturnType<HandlersMethods[Method]>>): DispatcherHandlerWithAppData<Method, HandlersMethods, AppDataType>;
    request<Method extends keyof RequestMethods>(method: Method, params: MethodParameters<RequestMethods[Method]>, appData: AppDataType): Promise<MethodReturnType<RequestMethods[Method]>>;
    notify<Method extends keyof RequestMethods>(method: Method, params: MethodParameters<RequestMethods[Method]>, appData: AppDataType): void;
    callToTransport(message: KissMessage, appData: AppDataType): void;
    handleMessage(message: KissMessage, appData: AppDataType): void;
    fromTransport(rawMessage: string, appData: AppDataType): void;
    clean(reason: string): void;
}
export {};
