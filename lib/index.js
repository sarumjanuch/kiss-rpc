"use strict";
// Request
// | MessageType | Id | Method | Params
Object.defineProperty(exports, "__esModule", { value: true });
exports.KissRpc = exports.DispatcherHandler = exports.KISS_RPC_ERRORS = exports.KissRpcError = void 0;
// Response
// | MessageType | Id | Result
// Error Response
// | MessageType | Id | ErrorResult
// Notification
// | MessageType | Method | Params
const generateRandomNumber = function () {
    return Math.round(Math.random() * 10000000);
};
class KissRpcError extends Error {
    constructor(code, message, id = -1, errorMessage = '') {
        super();
        this.code = code;
        this.message = message;
        this.id = id;
        this.errorMessage = errorMessage;
    }
}
exports.KissRpcError = KissRpcError;
exports.KISS_RPC_ERRORS = {
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
    }
};
class DispatcherHandler {
    constructor(fn, method) {
        this.guards = [];
        this.fn = fn;
        this.method = method;
    }
    addGuard(fn) {
        this.guards.push({
            type: 0 /* GuardType.Guard */,
            fn
        });
        return this;
    }
    addParamsGuard(fn) {
        this.guards.push({
            type: 1 /* GuardType.ParamGuard */,
            fn
        });
        return this;
    }
    addAppDataGuard(fn) {
        this.guards.push({
            type: 2 /* GuardType.AppData */,
            fn
        });
        return this;
    }
}
exports.DispatcherHandler = DispatcherHandler;
class KissRpc {
    appDataIsDefined(appData) {
        return appData !== undefined;
    }
    rejectPendingRequests(reason) {
        for (const request of this.pendingRequests.values()) {
            request.reject(reason);
        }
        this.pendingRequests.clear();
    }
    static parse(raw) {
        let object;
        try {
            object = JSON.parse(raw);
        }
        catch (error) {
            throw new KissRpcError(exports.KISS_RPC_ERRORS.PARSE_ERROR.code, exports.KISS_RPC_ERRORS.PARSE_ERROR.message);
        }
        if (!Array.isArray(object)) {
            throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
        }
        let message;
        switch (object[0]) {
            case 0 /* MessageType.Request */:
                object = object;
                if (typeof object[2] !== 'string') {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                if (typeof object[1] !== 'number') {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                return message = {
                    type: 0 /* MessageType.Request */,
                    id: object[1],
                    method: object[2],
                    params: Array.isArray(object[3]) ? object[3] : []
                };
            case 2 /* MessageType.Response */:
                object = object;
                if (typeof object[1] !== 'number') {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                return message = {
                    type: 2 /* MessageType.Response */,
                    id: object[1],
                    result: object[2]
                };
            case 1 /* MessageType.Notification */:
                object = object;
                if (typeof object[1] !== 'string') {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                return message = {
                    type: 1 /* MessageType.Notification */,
                    method: object[1],
                    params: object[2]
                };
            case 3 /* MessageType.ErrorResponse */:
                object = object;
                if (typeof object[1] !== 'number') {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                const err = object[2];
                if (!err || !err.code || !err.message) {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                if (typeof err.message !== 'string' || typeof err.code !== 'number') {
                    throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
                }
                return message = {
                    type: 3 /* MessageType.ErrorResponse */,
                    id: object[1],
                    error: err
                };
            default:
                throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
        }
    }
    registerToTransportCallback(cb) {
        this.toTransport = cb;
    }
    static createRequest(method, params) {
        return [0 /* MessageType.Request */, generateRandomNumber(), method, params];
    }
    static createResponse(id, data) {
        return [2 /* MessageType.Response */, id, data];
    }
    static createErrorResponse(id, errorCode, errorReason, errorMessage) {
        return [3 /* MessageType.ErrorResponse */, id, { code: errorCode, message: errorReason, errorMessage: errorMessage }];
    }
    static createNotification(method, params) {
        return [1 /* MessageType.Notification */, method, params];
    }
    constructor(options) {
        this.toTransport = null;
        this.requestTimeout = options.requestTimeout || 5000;
        this.dispatcher = new Map();
        this.pendingRequests = new Map();
    }
    registerHandler(method, handler) {
        const dispatcherHandler = new DispatcherHandler(handler, method);
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler;
    }
    request(...args) {
        const [method, params, appData] = args;
        const requestMessage = KissRpc.createRequest(method.toString(), params);
        return Promise.race([
            new Promise((resolve, reject) => {
                this.pendingRequests.set(requestMessage[1], {
                    id: requestMessage[1],
                    resolve,
                    reject
                });
                this.callToTransport(requestMessage, appData);
            }),
            new Promise((resolve, reject) => {
                setTimeout(() => {
                    this.pendingRequests.delete(requestMessage[1]);
                    reject(new KissRpcError(exports.KISS_RPC_ERRORS.REQUEST_TIMEOUT.code, exports.KISS_RPC_ERRORS.REQUEST_TIMEOUT.message));
                }, this.requestTimeout);
            })
        ]);
    }
    notify(...args) {
        const [method, params, appData] = args;
        if (!this.toTransport)
            return;
        // @ts-ignore
        this.toTransport(JSON.stringify(KissRpc.createNotification(method, params)), appData);
    }
    callToTransport(message, appData) {
        if (!this.toTransport)
            return;
        // @ts-ignore
        this.toTransport(JSON.stringify(message), appData);
    }
    handleMessage(message, appData) {
        switch (message.type) {
            case 0 /* MessageType.Request */:
            case 1 /* MessageType.Notification */:
                const handler = this.dispatcher.get(message.method);
                if (!handler)
                    return this.callToTransport(KissRpc.createErrorResponse(message.type === 0 /* MessageType.Request */ ? message.id : -1, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.code, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.message), appData);
                try {
                    if (handler.guards.length) {
                        for (const guard of handler.guards) {
                            switch (guard.type) {
                                case 0 /* GuardType.Guard */:
                                    guard.fn.apply(null, !appData ? message.params : [...message.params, appData]);
                                    break;
                                case 1 /* GuardType.ParamGuard */:
                                    guard.fn.apply(null, message.params);
                                    break;
                                case 2 /* GuardType.AppData */:
                                    if (this.appDataIsDefined(appData)) {
                                        guard.fn.apply(null, [appData]);
                                    }
                                    break;
                            }
                        }
                    }
                }
                catch (e) {
                    const err = e;
                    if (message.type === 1 /* MessageType.Notification */)
                        return;
                    return this.callToTransport(KissRpc.createErrorResponse(message.id, exports.KISS_RPC_ERRORS.GUARD_ERROR.code, exports.KISS_RPC_ERRORS.GUARD_ERROR.message, err.toString()), appData);
                }
                try {
                    let result;
                    if (this.appDataIsDefined(appData)) {
                        result = handler.fn.apply(null, [...message.params, appData]);
                    }
                    else {
                        result = handler.fn.apply(null, message.params);
                    }
                    // Notifications don't have any response
                    if (message.type === 1 /* MessageType.Notification */)
                        return;
                    if (result.then) {
                        result.then((res) => {
                            this.callToTransport(KissRpc.createResponse(message.id, res), appData);
                        }).catch((e) => {
                            this.callToTransport(KissRpc.createErrorResponse(message.id, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, e.message), appData);
                        });
                    }
                    else {
                        this.callToTransport(KissRpc.createResponse(message.id, result), appData);
                    }
                }
                catch (e) {
                    const err = e;
                    if (message.type === 1 /* MessageType.Notification */)
                        return;
                    this.callToTransport(KissRpc.createErrorResponse(message.id, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, err.message), appData);
                }
                break;
            case 2 /* MessageType.Response */:
            case 3 /* MessageType.ErrorResponse */:
                const pendingRequest = this.pendingRequests.get(message.id);
                if (pendingRequest) {
                    this.pendingRequests.delete(message.id);
                    if (message.type === 2 /* MessageType.Response */) {
                        pendingRequest.resolve(message.result);
                    }
                    else if (message.type === 3 /* MessageType.ErrorResponse */) {
                        pendingRequest.reject(new KissRpcError(message.error.code, message.error.message, message.id, message.error.errorMessage));
                    }
                }
        }
    }
    fromTransport(message, appData) {
        try {
            const kissMessage = KissRpc.parse(message);
            this.handleMessage(kissMessage, appData);
        }
        catch (e) {
            if (e instanceof KissRpcError) {
                if (!this.toTransport)
                    return;
                // @ts-ignore
                this.toTransport(JSON.stringify(KissRpc.createErrorResponse((kissMessage === null || kissMessage === void 0 ? void 0 : kissMessage.id) || -1, e.code, e.message, e.errorMessage || '')));
            }
        }
    }
}
exports.KissRpc = KissRpc;
