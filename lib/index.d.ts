export declare const enum MessageType {
    Request = 0,
    Notification = 1,
    Response = 2,
    ErrorResponse = 3
}
type MethodReturnType<Method> = Method extends (...args: any) => infer R ? R : any;
type MethodParameters<Method> = Method extends (...args: infer T) => any ? T : never;
type ToTransportCb<AppDataType> = AppDataType extends undefined ? (message: string) => void : (message: string, appData: AppDataType) => void;
type FromTransportParams<AppDataType> = AppDataType extends undefined ? [
    message: string
] : [
    message: string,
    appData: AppDataType
];
type AppendAppData<I, T extends unknown[]> = [...args: T, appData: I];
type AnyFunction = (...args: any) => any | Promise<any>;
type GuardFn<Method extends keyof Handlers, Handlers, AppDataType> = AppDataType extends undefined ? (...args: MethodParameters<Handlers[Method]>) => void : (...args: [...MethodParameters<Handlers[Method]>, AppDataType]) => void;
type KissMethod = string;
type KissRequestId = number;
type KissParams = any[];
type KissError = {
    code: number;
    message: string;
    errorMessage?: string;
};
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
type KissRpcOptions = {
    requestTimeout: number;
};
type KissPendingRequest<T> = {
    id: number;
    resolve: (value: MethodReturnType<T>) => void;
    reject: (value: unknown) => void;
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
export declare class DispatcherHandler<Method extends keyof Handlers, Handlers, AppDataType = undefined> {
    fn: AnyFunction;
    guards: Array<Guards>;
    method: Method;
    constructor(fn: AnyFunction, method: Method);
    addGuard(fn: GuardFn<Method, Handlers, AppDataType>): this;
    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this;
    addAppDataGuard(fn: (appData: AppDataType) => void): this;
}
export declare class KissRpc<RequestMethods, HandlersMethods = RequestMethods, AppDataType = undefined> {
    requestTimeout: number;
    toTransport: ToTransportCb<AppDataType> | null;
    dispatcher: Map<KissMethod, DispatcherHandler<any, HandlersMethods, AppDataType>>;
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>;
    static parse(raw: string): KissMessage;
    static createRequest(method: string, params: any[] | undefined): KissRequest;
    static createResponse(id: number, data: any): KissResponse;
    static createErrorResponse(id: number, errorCode: number, errorReason: string, errorMessage?: string): KissErrorResponse;
    static createNotification(method: string, params: any[]): KissNotification;
    constructor(options: KissRpcOptions);
    private appDataIsDefined;
    private rejectPendingRequests;
    private resetDispatcher;
    registerToTransportCallback(cb: ToTransportCb<AppDataType>): void;
    registerHandler<Method extends keyof HandlersMethods>(method: Method, handler: (...params: AppDataType extends undefined ? MethodParameters<HandlersMethods[Method]> : AppendAppData<AppDataType, MethodParameters<HandlersMethods[Method]>>) => MethodReturnType<HandlersMethods[Method]> | Promise<MethodReturnType<HandlersMethods[Method]>>): DispatcherHandler<Method, HandlersMethods, AppDataType>;
    request<Method extends keyof RequestMethods>(...args: AppDataType extends undefined ? [
        method: Method,
        params: MethodParameters<RequestMethods[Method]>
    ] : [
        method: Method,
        params: MethodParameters<RequestMethods[Method]>,
        appData: AppDataType
    ]): Promise<MethodReturnType<RequestMethods[Method]>>;
    notify<Method extends keyof RequestMethods>(...args: AppDataType extends undefined ? [
        method: Method,
        params: MethodParameters<RequestMethods[Method]>
    ] : [
        method: Method,
        params: MethodParameters<RequestMethods[Method]>,
        appData: AppDataType
    ]): void;
    callToTransport(message: KissMessage, appData?: AppDataType): void;
    handleMessage(message: KissMessage, appData?: AppDataType): void;
    fromTransport(...args: FromTransportParams<AppDataType>): void;
    clean(reason: string): void;
}
export {};
