"use strict";
// Request        [MessageType, Id, Method, Params]
// Response       [MessageType, Id, Result]
// Error Response [MessageType, Id, ErrorResult]
// Notification   [MessageType, Method, Params]
Object.defineProperty(exports, "__esModule", { value: true });
exports.KissRpcWithAppData = exports.DispatcherHandlerWithAppData = exports.KissRpc = exports.DispatcherHandler = exports.createNotification = exports.createErrorResponse = exports.createResponse = exports.createRequest = exports.parseMessage = exports.KISS_RPC_ERRORS = exports.KissRpcError = exports.isMessage = exports.isNotification = exports.isErrorResponse = exports.isResponse = exports.isRequest = exports.getMessageError = exports.getMessageResult = exports.getMessageId = exports.getMessageParams = exports.getMessageMethod = exports.getMessageType = void 0;
const TIMEOUT_CHECK_INTERVAL_MS = 100;
let requestIdCounter = 0;
const generateRequestId = () => (requestIdCounter = (requestIdCounter + 1) >>> 0);
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
    if (message.length > 4 || message.length < 2)
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
// Shared utility functions
function parseMessage(raw) {
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
exports.parseMessage = parseMessage;
function createRequest(method, params) {
    return [0 /* MessageType.Request */, generateRequestId(), method, params || []];
}
exports.createRequest = createRequest;
function createResponse(id, data) {
    return [2 /* MessageType.Response */, id, data];
}
exports.createResponse = createResponse;
function createErrorResponse(id, errorCode, errorReason, errorMessage) {
    return [3 /* MessageType.ErrorResponse */, id, { code: errorCode, message: errorReason, errorMessage: errorMessage }];
}
exports.createErrorResponse = createErrorResponse;
function createNotification(method, params) {
    return [1 /* MessageType.Notification */, method, params];
}
exports.createNotification = createNotification;
// ==================== KissRpc (no appData) ====================
class DispatcherHandler {
    constructor(fn, method) {
        this.guards = [];
        this.fn = fn;
        this.method = method;
    }
    addParamsGuard(fn) {
        this.guards.push(fn);
        return this;
    }
}
exports.DispatcherHandler = DispatcherHandler;
class KissRpc {
    constructor(options) {
        this.toTransport = null;
        this.timeoutCheckInterval = null;
        this.requestTimeout = (options === null || options === void 0 ? void 0 : options.requestTimeout) || 5000;
        this.dispatcher = new Map();
        this.pendingRequests = new Map();
    }
    rejectPendingRequests(error) {
        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }
        this.pendingRequests.clear();
        this.stopTimeoutChecker();
    }
    resetDispatcher() {
        for (const handler of this.dispatcher.values()) {
            handler.guards.length = 0;
        }
        this.dispatcher.clear();
    }
    startTimeoutChecker() {
        if (this.timeoutCheckInterval !== null)
            return;
        this.timeoutCheckInterval = setInterval(() => {
            const now = Date.now();
            const timedOutRequests = [];
            for (const [id, request] of this.pendingRequests.entries()) {
                if (now - request.timestamp >= this.requestTimeout) {
                    timedOutRequests.push(id);
                }
            }
            for (const id of timedOutRequests) {
                const request = this.pendingRequests.get(id);
                if (request) {
                    this.pendingRequests.delete(id);
                    request.reject(new KissRpcError(exports.KISS_RPC_ERRORS.REQUEST_TIMEOUT.code, exports.KISS_RPC_ERRORS.REQUEST_TIMEOUT.message));
                }
            }
            if (this.pendingRequests.size === 0) {
                this.stopTimeoutChecker();
            }
        }, TIMEOUT_CHECK_INTERVAL_MS);
    }
    stopTimeoutChecker() {
        if (this.timeoutCheckInterval !== null) {
            clearInterval(this.timeoutCheckInterval);
            this.timeoutCheckInterval = null;
        }
    }
    registerToTransportCallback(cb) {
        this.toTransport = cb;
    }
    registerHandler(method, handler) {
        const dispatcherHandler = new DispatcherHandler(handler, method);
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler;
    }
    request(method, params) {
        const requestMessage = createRequest(method.toString(), params);
        return new Promise((resolve, reject) => {
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
    notify(method, params) {
        this.callToTransport(createNotification(method.toString(), params));
    }
    callToTransport(message) {
        if (!this.toTransport)
            return;
        this.toTransport(JSON.stringify(message));
    }
    handleMessage(message) {
        const messageType = message[0];
        const messageId = (messageType === 0 /* MessageType.Request */ ||
            messageType === 2 /* MessageType.Response */ ||
            messageType === 3 /* MessageType.ErrorResponse */) ? message[1] : -1;
        const isNotif = messageType === 1 /* MessageType.Notification */;
        switch (messageType) {
            case 0 /* MessageType.Request */:
            case 1 /* MessageType.Notification */:
                const method = messageType === 0 /* MessageType.Request */ ? message[2] : message[1];
                const handler = this.dispatcher.get(method);
                if (!handler)
                    return this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.code, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.message));
                const params = messageType === 0 /* MessageType.Request */ ? message[3] : message[2];
                // Execute guards
                const guardsLength = handler.guards.length;
                try {
                    for (let i = 0; i < guardsLength; i++) {
                        handler.guards[i].apply(null, params);
                    }
                }
                catch (e) {
                    const err = e;
                    if (isNotif)
                        return;
                    return this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.GUARD_ERROR.code, exports.KISS_RPC_ERRORS.GUARD_ERROR.message, err.toString()));
                }
                // Execute handler
                try {
                    const result = handler.fn.apply(null, params);
                    if (isNotif)
                        return;
                    if (result && result.then) {
                        result.then((res) => {
                            this.callToTransport(createResponse(messageId, res));
                        }).catch((e) => {
                            this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, e.message));
                        });
                    }
                    else {
                        this.callToTransport(createResponse(messageId, result));
                    }
                }
                catch (e) {
                    const err = e;
                    if (isNotif)
                        return;
                    this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, err.message));
                }
                break;
            case 2 /* MessageType.Response */:
            case 3 /* MessageType.ErrorResponse */:
                const pendingRequest = this.pendingRequests.get(messageId);
                if (pendingRequest) {
                    this.pendingRequests.delete(messageId);
                    if (messageType === 2 /* MessageType.Response */) {
                        pendingRequest.resolve(message[2]);
                    }
                    else {
                        const error = message[2];
                        pendingRequest.reject(new KissRpcError(error.code, error.message, messageId, error.errorMessage));
                    }
                }
        }
    }
    fromTransport(rawMessage) {
        let message;
        try {
            message = parseMessage(rawMessage);
            this.handleMessage(message);
        }
        catch (e) {
            if (e instanceof KissRpcError) {
                this.callToTransport(createErrorResponse(-1, e.code, e.message, e.errorMessage || ''));
            }
        }
    }
    clean(reason) {
        this.rejectPendingRequests(new KissRpcError(exports.KISS_RPC_ERRORS.INTERNAL_ERROR.code, exports.KISS_RPC_ERRORS.INTERNAL_ERROR.message, -1, reason));
        this.resetDispatcher();
        this.stopTimeoutChecker();
        this.toTransport = null;
    }
}
exports.KissRpc = KissRpc;
KissRpc.parse = parseMessage;
KissRpc.createRequest = createRequest;
KissRpc.createResponse = createResponse;
KissRpc.createErrorResponse = createErrorResponse;
KissRpc.createNotification = createNotification;
class DispatcherHandlerWithAppData {
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
exports.DispatcherHandlerWithAppData = DispatcherHandlerWithAppData;
class KissRpcWithAppData {
    constructor(options) {
        this.toTransport = null;
        this.timeoutCheckInterval = null;
        this.requestTimeout = (options === null || options === void 0 ? void 0 : options.requestTimeout) || 5000;
        this.dispatcher = new Map();
        this.pendingRequests = new Map();
    }
    rejectPendingRequests(error) {
        for (const request of this.pendingRequests.values()) {
            request.reject(error);
        }
        this.pendingRequests.clear();
        this.stopTimeoutChecker();
    }
    resetDispatcher() {
        for (const handler of this.dispatcher.values()) {
            handler.guards.length = 0;
        }
        this.dispatcher.clear();
    }
    startTimeoutChecker() {
        if (this.timeoutCheckInterval !== null)
            return;
        this.timeoutCheckInterval = setInterval(() => {
            const now = Date.now();
            const timedOutRequests = [];
            for (const [id, request] of this.pendingRequests.entries()) {
                if (now - request.timestamp >= this.requestTimeout) {
                    timedOutRequests.push(id);
                }
            }
            for (const id of timedOutRequests) {
                const request = this.pendingRequests.get(id);
                if (request) {
                    this.pendingRequests.delete(id);
                    request.reject(new KissRpcError(exports.KISS_RPC_ERRORS.REQUEST_TIMEOUT.code, exports.KISS_RPC_ERRORS.REQUEST_TIMEOUT.message));
                }
            }
            if (this.pendingRequests.size === 0) {
                this.stopTimeoutChecker();
            }
        }, TIMEOUT_CHECK_INTERVAL_MS);
    }
    stopTimeoutChecker() {
        if (this.timeoutCheckInterval !== null) {
            clearInterval(this.timeoutCheckInterval);
            this.timeoutCheckInterval = null;
        }
    }
    registerToTransportCallback(cb) {
        this.toTransport = cb;
    }
    registerHandler(method, handler) {
        const dispatcherHandler = new DispatcherHandlerWithAppData(handler, method);
        this.dispatcher.set(method.toString(), dispatcherHandler);
        return dispatcherHandler;
    }
    request(method, params, appData) {
        const requestMessage = createRequest(method.toString(), params);
        return new Promise((resolve, reject) => {
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
    notify(method, params, appData) {
        this.callToTransport(createNotification(method.toString(), params), appData);
    }
    callToTransport(message, appData) {
        if (!this.toTransport)
            return;
        this.toTransport(JSON.stringify(message), appData);
    }
    handleMessage(message, appData) {
        const messageType = message[0];
        const messageId = (messageType === 0 /* MessageType.Request */ ||
            messageType === 2 /* MessageType.Response */ ||
            messageType === 3 /* MessageType.ErrorResponse */) ? message[1] : -1;
        const isNotif = messageType === 1 /* MessageType.Notification */;
        switch (messageType) {
            case 0 /* MessageType.Request */:
            case 1 /* MessageType.Notification */:
                const method = messageType === 0 /* MessageType.Request */ ? message[2] : message[1];
                const handler = this.dispatcher.get(method);
                if (!handler)
                    return this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.code, exports.KISS_RPC_ERRORS.METHOD_NOT_FOUND.message), appData);
                const params = messageType === 0 /* MessageType.Request */ ? message[3] : message[2];
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
                            case 0 /* GuardType.Guard */:
                                guard.fn.apply(null, paramsWithAppData);
                                break;
                            case 1 /* GuardType.ParamGuard */:
                                guard.fn.apply(null, params);
                                break;
                            case 2 /* GuardType.AppData */:
                                guard.fn.call(null, appData);
                                break;
                        }
                    }
                }
                catch (e) {
                    const err = e;
                    if (isNotif)
                        return;
                    return this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.GUARD_ERROR.code, exports.KISS_RPC_ERRORS.GUARD_ERROR.message, err.toString()), appData);
                }
                // Execute handler (reusing paramsWithAppData from above)
                try {
                    const result = handler.fn.apply(null, paramsWithAppData);
                    if (isNotif)
                        return;
                    if (result && result.then) {
                        result.then((res) => {
                            this.callToTransport(createResponse(messageId, res), appData);
                        }).catch((e) => {
                            this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, e.message), appData);
                        });
                    }
                    else {
                        this.callToTransport(createResponse(messageId, result), appData);
                    }
                }
                catch (e) {
                    const err = e;
                    if (isNotif)
                        return;
                    this.callToTransport(createErrorResponse(messageId, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.code, exports.KISS_RPC_ERRORS.APPLICATION_ERROR.message, err.message), appData);
                }
                break;
            case 2 /* MessageType.Response */:
            case 3 /* MessageType.ErrorResponse */:
                const pendingRequest = this.pendingRequests.get(messageId);
                if (pendingRequest) {
                    this.pendingRequests.delete(messageId);
                    if (messageType === 2 /* MessageType.Response */) {
                        pendingRequest.resolve(message[2]);
                    }
                    else {
                        const error = message[2];
                        pendingRequest.reject(new KissRpcError(error.code, error.message, messageId, error.errorMessage));
                    }
                }
        }
    }
    fromTransport(rawMessage, appData) {
        let message;
        try {
            message = parseMessage(rawMessage);
            this.handleMessage(message, appData);
        }
        catch (e) {
            if (e instanceof KissRpcError) {
                this.callToTransport(createErrorResponse(-1, e.code, e.message, e.errorMessage || ''), appData);
            }
        }
    }
    clean(reason) {
        this.rejectPendingRequests(new KissRpcError(exports.KISS_RPC_ERRORS.INTERNAL_ERROR.code, exports.KISS_RPC_ERRORS.INTERNAL_ERROR.message, -1, reason));
        this.resetDispatcher();
        this.stopTimeoutChecker();
        this.toTransport = null;
    }
}
exports.KissRpcWithAppData = KissRpcWithAppData;
KissRpcWithAppData.parse = parseMessage;
KissRpcWithAppData.createRequest = createRequest;
KissRpcWithAppData.createResponse = createResponse;
KissRpcWithAppData.createErrorResponse = createErrorResponse;
KissRpcWithAppData.createNotification = createNotification;
