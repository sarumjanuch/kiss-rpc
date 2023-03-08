"use strict";
// Request        [MessageType, Id, Method, Params]
// Response       [MessageType, Id, Result]
// Error Response [MessageType, Id, ErrorResult]
// Notification   [MessageType, Method, Params]
Object.defineProperty(exports, "__esModule", { value: true });
exports.KissRpc = exports.DispatcherHandler = exports.KISS_RPC_ERRORS = exports.KissRpcError = exports.isMessage = exports.isNotification = exports.isErrorResponse = exports.isResponse = exports.isRequest = exports.getMessageError = exports.getMessageResult = exports.getMessageId = exports.getMessageParams = exports.getMessageMethod = exports.getMessageType = void 0;
const generateRandomNumber = function () {
    return Math.round(Math.random() * 10000000);
};
function getMessageType(message) {
    return message[0];
}
exports.getMessageType = getMessageType;
function getMessageMethod(message) {
    switch (getMessageType(message)) {
        case 0 /* MessageType.Request */:
            return message[2];
        case 1 /* MessageType.Notification */:
            return message[1];
        case 2 /* MessageType.Response */:
        case 3 /* MessageType.ErrorResponse */:
            return '';
    }
}
exports.getMessageMethod = getMessageMethod;
function getMessageParams(message) {
    switch (getMessageType(message)) {
        case 0 /* MessageType.Request */:
            return message[3] || [];
        case 1 /* MessageType.Notification */:
            return message[2];
        default:
            return [];
    }
}
exports.getMessageParams = getMessageParams;
function getMessageId(message) {
    switch (getMessageType(message)) {
        case 0 /* MessageType.Request */:
        case 2 /* MessageType.Response */:
        case 3 /* MessageType.ErrorResponse */:
            return message[1];
        case 1 /* MessageType.Notification */:
            return -1;
    }
}
exports.getMessageId = getMessageId;
function getMessageResult(message) {
    switch (getMessageType(message)) {
        case 2 /* MessageType.Response */:
            return message[2];
        case 3 /* MessageType.ErrorResponse */:
            return message[2];
        default:
            return;
    }
}
exports.getMessageResult = getMessageResult;
function getMessageError(message) {
    switch (getMessageType(message)) {
        case 3 /* MessageType.ErrorResponse */:
            return message[2];
        default:
            return new KissRpcError(0, '');
    }
}
exports.getMessageError = getMessageError;
function isRequest(message) {
    return getMessageType(message) === 0 /* MessageType.Request */;
}
exports.isRequest = isRequest;
function isResponse(message) {
    return getMessageType(message) === 2 /* MessageType.Response */;
}
exports.isResponse = isResponse;
function isErrorResponse(message) {
    return getMessageType(message) === 3 /* MessageType.ErrorResponse */;
}
exports.isErrorResponse = isErrorResponse;
function isNotification(message) {
    return getMessageType(message) === 1 /* MessageType.Notification */;
}
exports.isNotification = isNotification;
function isMessage(message) {
    if (!Array.isArray(message))
        return false;
    if (message.length > 4 || message.length < 3)
        return false;
    if (typeof message[0] !== 'number')
        return false;
    if (message[0] < 0 || message[0] > 3)
        return false;
    switch (getMessageType(message)) {
        case 0 /* MessageType.Request */:
            if (typeof message[1] !== 'number')
                return false;
            if (typeof message[2] !== 'string')
                return false;
            break;
        case 2 /* MessageType.Response */:
            if (typeof message[1] !== 'number')
                return false;
            break;
        case 3 /* MessageType.ErrorResponse */:
            if (typeof message[1] !== 'number')
                return false;
            if (typeof message[2] !== 'object')
                return false;
            if (typeof message[2].code !== 'number')
                return false;
            if (typeof message[2].message !== 'string')
                return false;
            break;
        case 1 /* MessageType.Notification */:
            if (typeof message[1] !== 'string')
                return false;
            break;
        default:
            return false;
    }
    return true;
}
exports.isMessage = isMessage;
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
    },
    TRANSPORT_ERROR: {
        code: 1008,
        message: 'Underlying transport issue'
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
    static parse(raw) {
        let message;
        try {
            message = JSON.parse(raw);
        }
        catch (error) {
            throw new KissRpcError(exports.KISS_RPC_ERRORS.PARSE_ERROR.code, exports.KISS_RPC_ERRORS.PARSE_ERROR.message);
        }
        if (!isMessage(message)) {
            throw new KissRpcError(exports.KISS_RPC_ERRORS.INVALID_REQUEST.code, exports.KISS_RPC_ERRORS.INVALID_REQUEST.message);
        }
        return message;
    }
    static createRequest(method, params) {
        return [0 /* MessageType.Request */, generateRandomNumber(), method, params || []];
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
    appDataIsDefined(appData) {
        return appData !== undefined && appData !== null;
    }
    rejectPendingRequests(error) {
        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }
        this.pendingRequests.clear();
    }
    resetDispatcher() {
        for (const handler of this.dispatcher.values()) {
            handler.guards.length = 0;
        }
        this.dispatcher.clear();
    }
    registerToTransportCallback(cb) {
        this.toTransport = cb;
    }
    registerHandler(method, handler) {
        const dispatcherHandler = new DispatcherHandler(handler, method);
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler;
    }
    request(...args) {
        const requestMessage = KissRpc.createRequest(args[0].toString(), args[1]);
        return Promise.race([
            new Promise((resolve, reject) => {
                this.pendingRequests.set(requestMessage[1], {
                    id: requestMessage[1],
                    resolve,
                    reject
                });
                this.callToTransport(requestMessage, args[2]);
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
        this.callToTransport(KissRpc.createNotification(args[0].toString(), args[1]), args[2]);
    }
    callToTransport(message, appData) {
        if (!this.toTransport)
            return;
        this.appDataIsDefined(appData) ?
            this.toTransport(JSON.stringify(message), appData) :
            // @ts-ignore because we know that appData is undefined
            // and also because we know that toTransport is defined
            // and because fuck you typescript
            this.toTransport(JSON.stringify(message));
    }
    handleMessage(message, appData) {
        switch (getMessageType(message)) {
            case 0 /* MessageType.Request */:
            case 1 /* MessageType.Notification */:
                const handler = this.dispatcher.get(getMessageMethod(message));
                if (!handler)
                    return this.callToTransport(KissRpc.createErrorResponse(isRequest(message) ? getMessageId(message) : -1, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.code, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.message), appData);
                // Execute guards attached to the handler
                try {
                    if (handler.guards.length) {
                        for (const guard of handler.guards) {
                            switch (guard.type) {
                                case 0 /* GuardType.Guard */:
                                    guard.fn.apply(null, !appData ? getMessageParams(message) : [...getMessageParams(message), appData]);
                                    break;
                                case 1 /* GuardType.ParamGuard */:
                                    guard.fn.apply(null, getMessageParams(message));
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
                    if (isNotification(message))
                        return;
                    return this.callToTransport(KissRpc.createErrorResponse(getMessageId(message), exports.KISS_RPC_ERRORS.GUARD_ERROR.code, exports.KISS_RPC_ERRORS.GUARD_ERROR.message, err.toString()), appData);
                }
                // Guard passed, execute handler
                try {
                    let result;
                    if (this.appDataIsDefined(appData)) {
                        result = handler.fn.apply(null, [...getMessageParams(message), appData]);
                    }
                    else {
                        result = handler.fn.apply(null, getMessageParams(message));
                    }
                    // Notifications don't have any response
                    if (isNotification(message))
                        return;
                    if (result.then) {
                        result.then((res) => {
                            this.callToTransport(KissRpc.createResponse(getMessageId(message), res), appData);
                        }).catch((e) => {
                            this.callToTransport(KissRpc.createErrorResponse(getMessageId(message), exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, e.message), appData);
                        });
                    }
                    else {
                        this.callToTransport(KissRpc.createResponse(getMessageId(message), result), appData);
                    }
                }
                catch (e) {
                    const err = e;
                    if (isNotification(message))
                        return;
                    this.callToTransport(KissRpc.createErrorResponse(getMessageId(message), exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, err.message), appData);
                }
                break;
            case 2 /* MessageType.Response */:
            case 3 /* MessageType.ErrorResponse */:
                const pendingRequest = this.pendingRequests.get(getMessageId(message));
                if (pendingRequest) {
                    this.pendingRequests.delete(getMessageId(message));
                    if (isResponse(message)) {
                        pendingRequest.resolve(getMessageResult(message));
                    }
                    else if (isErrorResponse(message)) {
                        const error = getMessageError(message);
                        pendingRequest.reject(new KissRpcError(error.code, error.message, getMessageId(message), error.errorMessage));
                    }
                }
        }
    }
    fromTransport(...args) {
        let message;
        try {
            message = KissRpc.parse(args[0]);
            // handleMessage will call toTransport if it's defined for any errors,
            // so we don't need to check it here the only thing we care if message
            // was parsed correctly and is valid
            this.appDataIsDefined(args[1]) ?
                this.handleMessage(message, args[1]) :
                this.handleMessage(message);
        }
        catch (e) {
            if (e instanceof KissRpcError) {
                this.callToTransport(KissRpc.createErrorResponse(-1, e.code, e.message, e.errorMessage || ''), args[1]);
            }
        }
    }
    clean(reason) {
        this.rejectPendingRequests(new KissRpcError(exports.KISS_RPC_ERRORS.INTERNAL_ERROR.code, exports.KISS_RPC_ERRORS.INTERNAL_ERROR.message, -1, reason));
        this.resetDispatcher();
        this.toTransport = null;
    }
}
exports.KissRpc = KissRpc;
