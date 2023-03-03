export declare const enum MessageType {
    Request = 0,
    Notification = 1,
    Response = 2,
    ErrorResponse = 3
}
type MethodReturnType<Method> = Method extends (...args: any) => infer R ? R : any;
type MethodParameters<Method> = Method extends (...args: infer T) => any ? T : never;
type AppendAppData<I, T extends unknown[]> = [...args: T, appData: I];
type AnyFunction = (...args: any) => any | Promise<any>;
export type KissRequest = [MessageType.Request, number, string, any[]];
export type KissResponse = [MessageType.Response, number, any];
export type KissNotification = [MessageType.Notification, number, any[]];
export type KissErrorResponse = [MessageType.ErrorResponse, number, {
    code: number;
    message: string;
    errorMessage?: string;
}];
export type KissMessageRaw = KissRequest | KissResponse | KissNotification | KissErrorResponse;
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
};
export type KissMessage = {
    type: MessageType.Request;
    id: number;
    method: string;
    params: any[];
} | {
    type: MessageType.Notification;
    method: string;
    params: any[];
} | {
    type: MessageType.Response;
    id: number;
    result: any;
} | {
    type: MessageType.ErrorResponse;
    id: number;
    error: {
        code: number;
        message: string;
        errorMessage?: string;
    };
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
type KissRpcMethod = string;
type KissRequestId = number;
type KissPendingRequest<T> = {
    id: number;
    resolve: (value: MethodReturnType<T>) => void;
    reject: (value: unknown) => void;
};
export declare class DispatcherHandler<Method extends keyof Handlers, Handlers, AppDataType = undefined> {
    fn: AnyFunction;
    guards: Array<Guards>;
    method: Method;
    constructor(fn: (...args: any) => any | Promise<any>, method: Method);
    addGuard(fn: (...params: AppDataType extends undefined ? MethodParameters<Handlers[Method]> : AppendAppData<AppDataType, MethodParameters<Handlers[Method]>>) => void): this;
    addParamsGuard(fn: (...args: MethodParameters<Handlers[Method]>) => void): this;
    addAppDataGuard(fn: (appData: AppDataType) => void): this;
}
export declare class KissRpc<RequestMethods, HandlersMethods = RequestMethods, AppDataType = undefined> {
    requestTimeout: number;
    toTransport: ((...args: AppDataType extends undefined ? [message: string] : [message: string, appData: AppDataType]) => void) | null;
    dispatcher: Map<KissRpcMethod, DispatcherHandler<any, HandlersMethods, AppDataType>>;
    pendingRequests: Map<KissRequestId, KissPendingRequest<keyof RequestMethods>>;
    appDataIsDefined(appData: AppDataType | undefined): appData is AppDataType;
    rejectPendingRequests(reason: string): void;
    static parse(raw: string): KissMessage;
    registerToTransportCallback(cb: (...args: AppDataType extends undefined ? [message: string] : [message: string, appData: AppDataType]) => void): void;
    static createRequest(method: string, params: any[]): KissRequest;
    static createResponse(id: number, data: any): KissResponse;
    static createErrorResponse(id: number, errorCode: number, errorReason: string, errorMessage?: string): KissErrorResponse;
    static createNotification(method: string, params: any[]): (string | any[] | MessageType)[];
    constructor(options: KissRpcOptions);
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
    callToTransport(message: KissMessageRaw, appData?: AppDataType): void;
    handleMessage(message: KissMessage, appData?: AppDataType): void;
    fromTransport(message: string, appData?: AppDataType): void;
}
export {};
