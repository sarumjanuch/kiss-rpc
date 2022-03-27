import {KissRpc} from "./index";
 
type AppData = {
    sessionId: string,
    name: string,

    age: number,
    authenticated: boolean
}
 
const isAuthenticatedGuard = (appData: AppData) => { if (!appData.authenticated) throw new Error('Unauthenticated session'); }
 
async function start() {
 
    type ClientRpcMethods = {
        add: (a: number, b: number) => number
        test: (a: string, b: string) => string
    }
 
    type ServerRpcMethods = {
        remove: (a: number, b: number) => number
        test1: (a: string, b: string) => string
    }
 
    const client = new KissRpc<ServerRpcMethods, ClientRpcMethods>({
        requestTimeout: 5000
    });
 
    const server = new KissRpc<ClientRpcMethods, ServerRpcMethods, AppData>({
        requestTimeout: 5000
    });
 
    client.registerToTransportCallback((message) => {
        console.log(message)
        server.fromTransport(message, {sessionId: '123', name:'eugen', age:12, authenticated: true})
    })
 
    server.registerToTransportCallback((message, {sessionId}) => {
        console.log(message)
        console.log(sessionId)
        client.fromTransport(message)
    });
 
    server.registerHandler('remove', (a, b, {name, sessionId}) => {
        console.log(sessionId)
        //throw new Error('test')
        return a + b
    });
 
    server.registerHandler('test1', (a, b, {name, sessionId}) => {
        console.log(sessionId)
        //throw new Error('test')
        return a + b
    }).addAppDataGuard(isAuthenticatedGuard);
 
    client.registerHandler('test', (a: string, b: string) => {
        return a + b
    })
 
    try {
        const res = await server.request('test', ['1', '2'], {name: 'eugene', sessionId: 'asd',age:123, authenticated: false});
        console.log(res);
        const res2 = await client.request('test1', ['aasd', 'fasdfa']);
        console.log(res2)
    } catch (e) {
        console.error(e)
    }
 
 
 
}
 
start()
