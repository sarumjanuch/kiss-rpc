import { strict as assert } from 'assert';
import { test } from 'node:test';
import { promisify } from 'util';

import { KissRpc, KissRpcError, MessageType, KissMessage, KISS_RPC_ERRORS } from './index';

test('KissRpc.parse() should correctly parse a valid Request', () => {
    const rawRequest = JSON.stringify([MessageType.Request, 1, 'testMethod', [1, 2, 3]]);
    const expectedRequest: KissMessage = {
        type: MessageType.Request,
        id: 1,
        method: 'testMethod',
        params: [1, 2, 3],
    };
    const parsedRequest = KissRpc.parse(rawRequest);

    assert.deepStrictEqual(parsedRequest, expectedRequest);
});

test('KissRpc.parse() should correctly parse a valid Response', () => {
    const rawResponse = JSON.stringify([MessageType.Response, 1, 'testResult']);
    const expectedResponse: KissMessage = {
        type: MessageType.Response,
        id: 1,
        result: 'testResult',
    };
    const parsedResponse = KissRpc.parse(rawResponse);

    assert.deepStrictEqual(parsedResponse, expectedResponse);
});

test('KissRpc.parse() should correctly parse a valid Notification', () => {
    const rawNotification = JSON.stringify([MessageType.Notification, 'testMethod', [1, 2, 3]]);
    const expectedNotification: KissMessage = {
        type: MessageType.Notification,
        method: 'testMethod',
        params: [1, 2, 3],
    };
    const parsedNotification = KissRpc.parse(rawNotification);

    assert.deepStrictEqual(parsedNotification, expectedNotification);
});

test('KissRpc.parse() should correctly parse a valid ErrorResponse', () => {
    const rawErrorResponse = JSON.stringify([MessageType.ErrorResponse, 1, { code: 100, message: 'testError', errorMessage: 'Test error message' }]);
    const expectedErrorResponse: KissMessage = {
        type: MessageType.ErrorResponse,
        id: 1,
        error: { code: 100, message: 'testError', errorMessage: 'Test error message' },
    };
    const parsedErrorResponse = KissRpc.parse(rawErrorResponse);

    assert.deepStrictEqual(parsedErrorResponse, expectedErrorResponse);
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
            'test.return_object': (a: {[key:string]: string}) => {[key:string]: string};
        };

        type ServerRpcMethods = {
            'test.add_numbers': (a: number, b: number) => number;
            'test.add_string': (a: string, b: string) => string;
            'test.return_array': (a: string, b: string, c: number, d: boolean) => any[];
            'test.return_object': (a: {[key:string]: string}) => {[key:string]: string};
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
            server.fromTransport(message, {sessionId: '123', name:'eugen', age: 12, authenticated: true})
        })

        server.registerToTransportCallback((message, {sessionId}) => {
            client.fromTransport(message)
        });

        test('should handle request from client to server and return response', async () => {
            const expectedResult = 1 + 1;
            server.registerHandler('test.add_numbers', (a, b) => {
                return a + b;
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.add_numbers', [1, 1]);

            assert.strictEqual(result, expectedResult);
        });

        test('should handle request from client to server and return response', async () => {
            const expectedResult = 'aasd' + 'fasdfa';
            server.registerHandler('test.add_string', (a, b) => {
                return a + b;
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.add_string', ['aasd', 'fasdfa']);

            assert.strictEqual(result, expectedResult);
        });

        test('should handle request from client to server and return response', async () => {
            const expectedResult = ['Hello', 'World', 123, true];
            server.registerHandler('test.return_array', (a, b,c, d) => {
                return [a, b, c, d];
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.return_array', ['Hello', 'World', 123, true]);

            assert.strictEqual(result[0], expectedResult[0]);
            assert.strictEqual(result[1], expectedResult[1]);
            assert.strictEqual(result[2], expectedResult[2]);
            assert.strictEqual(result[3], expectedResult[3]);
        });

        test('should handle request with proper AppData', async () => {
            const expectedAppData = { sessionId: '123', name:'eugen', age: 12, authenticated: true };
            server.registerHandler('test.return_array', (a, b,c, d, appData) => {
                assert.strictEqual(appData?.age, expectedAppData.age);
                assert.strictEqual(appData?.name, expectedAppData.name);
                assert.strictEqual(appData?.sessionId, expectedAppData.sessionId);
                assert.strictEqual(appData?.authenticated, expectedAppData.authenticated);
                return [a, b, c, d];
            }).addAppDataGuard(isAuthenticatedGuard);
        });

        test('should handle request from client to server and return response', async () => {
            const expectedResult = { hello: 'world' }

            server.registerHandler('test.return_object', (a) => {
                return a;
            }).addAppDataGuard(isAuthenticatedGuard);

            const result = await client.request('test.return_object', [{ hello: 'world' }]);

            assert.strictEqual(result?.hello, expectedResult.hello);
        });

        test('should handle request from server to client and return response', async () => {
            const expectedResult = 1 + 2;
            client.registerHandler('test.add_numbers', (a: number, b: number) => {
                return a + b;
            });

            const result = await server.request('test.add_numbers', [1, 2], { sessionId: '123', name:'eugen', age: 12, authenticated: true });

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

            server.registerHandler('test.notification', tracker.calls(() => {}));
            await client.notify('test.notification', []);
            tracker.verify();
        });
    });
});