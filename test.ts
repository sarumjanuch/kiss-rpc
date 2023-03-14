import {strict as assert} from 'assert';
import {test} from 'node:test';

import {
    KissRpc,
    KissRpcError,
    MessageType,
    KissMessage,
    KissRequest,
    KissErrorResponse,
    KissResponse,
    KissNotification,
    getMessageType,
    getMessageMethod,
    getMessageId,
    getMessageParams,
    getMessageResult,
    getMessageError,
    KISS_RPC_ERRORS, isResponse, isRequest, isErrorResponse, isMessage, isNotification
} from './index';

test('getMessageType returns correct type', () => {
    const request: KissRequest = [MessageType.Request, 1, 'method', []];
    const response: KissResponse = [MessageType.Response, 1, 'result'];
    const errorResponse: KissErrorResponse = [MessageType.ErrorResponse, 1, {code: 1, message: 'error'}];
    const notification: KissNotification = [MessageType.Notification, 'method', []];

    assert.equal(getMessageType(request), MessageType.Request);
    assert.equal(getMessageType(response), MessageType.Response);
    assert.equal(getMessageType(errorResponse), MessageType.ErrorResponse);
    assert.equal(getMessageType(notification), MessageType.Notification);
});

test('getMessageMethod returns correct method', () => {
    const request: KissRequest = [MessageType.Request, 1, 'method', []];
    const notification: KissNotification = [MessageType.Notification, 'method', []];

    assert.equal(getMessageMethod(request), 'method');
    assert.equal(getMessageMethod(notification), 'method');
});

test('getMessageParams returns correct params', () => {
    const request: KissRequest = [MessageType.Request, 1, 'method', ['param1', 'param2']];
    const notification: KissNotification = [MessageType.Notification, 'method', ['param1', 'param2']];

    assert.deepEqual(getMessageParams(request), ['param1', 'param2']);
    assert.deepEqual(getMessageParams(notification), ['param1', 'param2']);
});

test('getMessageId returns correct id', () => {
    const request: KissRequest = [MessageType.Request, 1, 'method', []];
    const response: KissResponse = [MessageType.Response, 1, 'result'];
    const errorResponse: KissErrorResponse = [MessageType.ErrorResponse, 1, {code: 1, message: 'error'}];

    assert.equal(getMessageId(request), 1);
    assert.equal(getMessageId(response), 1);
    assert.equal(getMessageId(errorResponse), 1);
});

test('getMessageResult returns correct result', () => {
    const response: KissResponse = [MessageType.Response, 1, 'result'];
    const errorResponse: KissErrorResponse = [MessageType.ErrorResponse, 1, {code: 1, message: 'error'}];

    assert.equal(getMessageResult(response), 'result');
    assert.deepEqual(getMessageResult(errorResponse), {code: 1, message: 'error'});
});

test('getMessageError returns correct error', () => {
    const errorResponse: KissErrorResponse = [MessageType.ErrorResponse, 1, {code: 1, message: 'error'}];

    assert.deepEqual(getMessageError(errorResponse), {code: 1, message: 'error'});
});

test('isRequest returns true if message is request', () => {
    const request: KissRequest = [MessageType.Request, 1, 'method', []];

    assert.equal(isRequest(request), true);
    assert.equal(isRequest([MessageType.Response, 1, 'result']), false);
});

test('isResponse returns true if message is response', () => {
    const response: KissResponse = [MessageType.Response, 1, 'result'];

    assert.equal(isResponse(response), true);
    assert.equal(isResponse([MessageType.Request, 1, 'method', []]), false);
});

test('isErrorResponse returns true if message is error response', () => {
    const errorResponse: KissErrorResponse = KissRpc.createErrorResponse(MessageType.ErrorResponse, 1, 'error');
    assert.equal(isErrorResponse(errorResponse), true);
    assert.equal(isErrorResponse([MessageType.Request, 1, 'method', []]), false);
});

test('isNotification returns true if message is notification', () => {
    const notification: KissNotification = KissRpc.createNotification('method', []);
    assert.equal(isNotification(notification), true);
    assert.equal(isNotification([MessageType.Request, 1, 'method', []]), false);
});

test('isMessage should return true for valid KissMessage', () => {
    const message: KissMessage = [MessageType.Request, 1, 'myMethod', []];
    assert.ok(isMessage(message));
});

test('isMessage should return false for invalid KissMessage', () => {
    const message: any = ['invalid message'];
    assert.ok(!isMessage(message));
});

test('isMessage should return false for array with invalid length', () => {
    const message: any = [MessageType.Request];
    assert.ok(!isMessage(message));
});

test('isMessage should return false for invalid message type', () => {
    const message: any = [-1, 1, 'myMethod', []];
    assert.ok(!isMessage(message));
});

test('isMessage should return false for invalid request message', () => {
    const message: any = [MessageType.Request, 'invalid id', 123, []];
    assert.ok(!isMessage(message));
});

test('isMessage should return false for invalid response message', () => {
    const message: any = [MessageType.Response, 'invalid id', 'invalid result'];
    assert.ok(!isMessage(message));
});

test('isMessage should return false for invalid error response message', () => {
    const message: any = [MessageType.ErrorResponse, 'invalid id', { code: 1, message: 'invalid error' }];
    assert.ok(!isMessage(message));
});

test('isMessage should return false for invalid notification message', () => {
    const message: any = [MessageType.Notification, 123];
    assert.ok(!isMessage(message));
});

test('KissRpc.parse() should throw a KissRpcError with code KISS_RPC_ERRORS.PARSE_ERROR.code when parsing an invalid JSON message', () => {
    const invalidJson = '{ invalid json }';

    assert.throws(() => KissRpc.parse(invalidJson), (error: KissRpcError) => {
        return error.code === KISS_RPC_ERRORS.PARSE_ERROR.code && error.message === KISS_RPC_ERRORS.PARSE_ERROR.message;
    });
});

test('KissRpc.parse() should throw a KissRpcError with code KISS_RPC_ERRORS.INVALID_REQUEST.code when parsing an invalid Request message', () => {
    const invalidRequest = JSON.stringify([MessageType.Request, 1, 2, [1, 2, 3]]);

    assert.throws(() => KissRpc.parse(invalidRequest), (error: KissRpcError) => {
        return error.code === KISS_RPC_ERRORS.INVALID_REQUEST.code && error.message === KISS_RPC_ERRORS.INVALID_REQUEST.message;
    });
});

test('KissRpc.parse() should throw a KissRpcError with code KISS_RPC_ERRORS.INVALID_REQUEST.code when parsing an invalid Response message', () => {
    const invalidResponse = JSON.stringify([MessageType.Response, '1', 'testResult']);

    assert.throws(() => KissRpc.parse(invalidResponse), (error: KissRpcError) => {
        return error.code === KISS_RPC_ERRORS.INVALID_REQUEST.code && error.message === KISS_RPC_ERRORS.INVALID_REQUEST.message;
    });
});

test('KissRpc', (t) => {
    type AppData = {
        sessionId: string;
        name: string;
        age: number;
        authenticated: boolean;
    };

    const isAuthenticatedGuard = (appData: AppData) => {
        if (!appData.authenticated) throw new Error('Unauthenticated session');
    };

    t.test('with ClientRpcMethods and ServerRpcMethods', () => {
        type ClientRpcMethods = {
            'test.add_numbers': (a: number, b: number) => number;
            'test.add_string': (a: string, b: string) => string;
            'test.return_array': (a: string, b: string, c: number, d: boolean) => any[];
            'test.return_object': (a: { [key: string]: string }) => { [key: string]: string };
        };

        type ServerRpcMethods = {
            'test.add_numbers': (a: number, b: number) => number;
            'test.add_string': (a: string, b: string) => string;
            'test.return_array': (a: string, b: string, c: number, d: boolean) => any[];
            'test.return_object': (a: { [key: string]: string }) => { [key: string]: string };
            'test.error': () => void;
            'test.notification': () => void;
        };

        const client = new KissRpc<ServerRpcMethods, ClientRpcMethods>({
            requestTimeout: 5000,
        });

        const server = new KissRpc<ClientRpcMethods, ServerRpcMethods, AppData>({
            requestTimeout: 5000,
        });

        client.registerToTransportCallback((message) => {
            server.fromTransport(message, {sessionId: '123', name: 'eugen', age: 12, authenticated: true});
        })

        server.registerToTransportCallback((message, appData) => {
            client.fromTransport(message);
        });

        test('should handle request from client to server and return response numbers', async () => {
            const expectedResult = 1 + 1;
            server.registerHandler('test.add_numbers', (a, b) => {
                return a + b;
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.add_numbers', [1, 1]);

            assert.strictEqual(result, expectedResult);
        });

        test('should handle request from client to server and return response strings', async () => {
            const expectedResult = 'aasd' + 'fasdfa';
            server.registerHandler('test.add_string', (a, b) => {
                return a + b;
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.add_string', ['aasd', 'fasdfa']);

            assert.strictEqual(result, expectedResult);
        });

        test('should handle request from client to server and return response array', async () => {
            const expectedResult = ['Hello', 'World', 123, true];
            server.registerHandler('test.return_array', (a, b, c, d) => {
                return [a, b, c, d];
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.return_array', ['Hello', 'World', 123, true]);

            assert.strictEqual(result[0], expectedResult[0]);
            assert.strictEqual(result[1], expectedResult[1]);
            assert.strictEqual(result[2], expectedResult[2]);
            assert.strictEqual(result[3], expectedResult[3]);
        });

        test('should handle request with proper AppData', async () => {
            const expectedAppData = {sessionId: '123', name: 'eugen', age: 12, authenticated: true};
            server.registerHandler('test.return_array', (a, b, c, d, appData) => {
                assert.strictEqual(appData?.age, expectedAppData.age);
                assert.strictEqual(appData?.name, expectedAppData.name);
                assert.strictEqual(appData?.sessionId, expectedAppData.sessionId);
                assert.strictEqual(appData?.authenticated, expectedAppData.authenticated);
                return [a, b, c, d];
            }).addAppDataGuard(isAuthenticatedGuard);
        });

        test('should handle request from client to server and return response object', async () => {
            const expectedResult = {hello: 'world'}

            server.registerHandler('test.return_object', (a) => {
                return a;
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.return_object', [{hello: 'world'}]);

            assert.strictEqual(result?.hello, expectedResult.hello);
        });

        test('should handle request from server to client and return response numbers', async () => {
            const expectedResult = 1 + 2;
            client.registerHandler('test.add_numbers', (a: number, b: number) => {
                return a + b;
            });

            const result = await server.request('test.add_numbers', [1, 2], {
                sessionId: '123',
                name: 'eugen',
                age: 12,
                authenticated: true
            });

            assert.strictEqual(result, expectedResult);
        });

        test('should handle error on server side and reject the client request', async () => {
            const errorMessage = 'Test error';
            server.registerHandler('test.error', () => {
                throw new Error(errorMessage);
            });

            try {
                await client.request('test.error', []);
                assert.fail('The promise should have been rejected');
            } catch (error) {
                assert(error instanceof KissRpcError);
                assert.strictEqual(error.errorMessage, errorMessage);
            }
        });

        test('should handle notification on server', async () => {
            const tracker = new assert.CallTracker();

            server.registerHandler('test.notification', tracker.calls(() => {
            }));
            await client.notify('test.notification', []);
            tracker.verify();
        });

        test('should handle request to method that return void', async () => {
            const tracker = new assert.CallTracker();

            try {
                server.registerHandler('test.notification', tracker.calls(() => {
                }));
                await client.request('test.notification', []);
                tracker.verify();
            } catch (error) {
                assert.fail('This should not throw', error);
            }
        });
    });
});