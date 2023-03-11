# KISS-RPC

KISS-RPC (Keep It Stupid Simple RPC) is a simple and lightweight library for implementing remote procedure call (RPC) in TypeScript/JavaScript. It uses a custom JSON based format for messages, similar to JSON-RPC, but with fewer overheads and optimized for high throughput. It works both in browser and Node.js environments.

## Transport
KISS-RPC is designed to be transport agnostic, so you can use it with any transport layer, such as WebSocket, HTTP, TCP, stdio, message brokers... you name it. Also, the protocol is very simple, so you can implement your own client or server in any language.

## Installation

```bash 
npm install kiss-rpc 
```
## Type Safety
The main goal of KISS-RPC is to provide a Type Safe RPC library using TypeScript built-in type primitives. It also provides a simple and easy to use API for both client and server.


## Protocol Specification
KISS-RPC has four types of messages: Request, Response, Error Response and Notification. All messages are encoded in JSON format. The message type is determined by the first element of the array. The following table shows the message format for each type.
```
Request        [MessageType, Id, Method, Params]
Response       [MessageType, Id, Result]
Error Response [MessageType, Id, ErrorResult]
Notification   [MessageType, Method, Params]
```
- **Request** is a stateful message, which requires a response. 
- **Response** or **Error Response** are one of two possible outcomes of request. 
- **Notification** is a stateless message, which does not require a response.

## Integration
Library provides two simple classes in order to exchange messages that are hooks to/from the transport layer: 
- **instance.registerToTransportCallback** allows to register user defined callback when library needs to send a message to the other side.
- **instance.handleMessage** allows to pass a message received from the other side to the library.

```typescript
type ServerRpcMethods = {
	add: (a: number, b: number) => number;
};

const client = new KissRpc<ServerRpcMethods>({
	requestTimeout: 5000
});

client.registerToTransportCallback((message) => {
	console.log(message);
	// Logic to send message to transport.
});

myTransport.on('message', (message : string) => {
	client.fromTransport(message);
});

```

## Usage Example
When Kiss-RPC is instantiated it provide a user to define three generic types with following signature:
```typescript 
class KissRpc<RequestMethods, HandlersMethods = RequestMethods, AppDataType = undefined>
 ```
- **RequestMethods** is a type that defines methods that can be called using request or notify methods on remote party. Mandatory argument.
- **HandlersMethods** is a type that defines methods that we can handle using registerHandler. Optional argument. If not provided, it will be the same as **RequestMethods**, which means that we may handle the same set of methods as we can call on remote.
- **AppDataType** is a type that defines additional data that can be passed to the library and can be accessed from the handlers. Optional argument. If not provided, it will be undefined. Useful when you want to pass some data to the handlers i.e. some kind of context like user session, or socket information.

All examples omit transport layer implementation for simplicity.
### Simple Example
```typescript
// Define methods that can be called on remote party.
type ServerRpcMethods = {
  add: (a: number, b: number) => number;
  log: (message: string) => void;
};
// Create client and server instances.
const client = new KissRpc<ServerRpcMethods>({
  // Optional. Default value is 5000.
  // If no response is received within this time, 
  // request will be rejected.
  requestTimeout: 5000
});

const server = new KissRpc<ServerRpcMethods>({
  requestTimeout: 5000
});

// Register callback that will be called when library needs to send a message to the other side.
client.registerToTransportCallback((message) => {
  // Logic to send message to transport. 
  // In this example we just forward it to the server instance.
  server.fromTransport(message);
});

server.registerToTransportCallback((message) => {
  client.fromTransport(message);
});

// Register handlers on the server. 
// Typseript will make sure that you are following ServerRpcMethods interface.
server.registerHandler('add', (a, b) => a + b);
server.registerHandler('log', (message) => console.log(message));

// Call method on the server using request.
// Typseript will make sure that you are following ServerRpcMethods interface.
const result = await client.request('add', [1, 2]);

// Call method on the server using notify. No response is expected.
// Typseript will make sure that you are following ServerRpcMethods interface.
client.notify('log', 'Hello World!');
 ```

## App Data
KISS-RPC provides a way to pass additional data to the handlers. This can be useful when you want to pass some kind of context like user session, or socket information.
```typescript
type ServerRpcMethods = {
  add: (a: number, b: number) => number;
};

type User = {
  userId: string;
  userRole: string;
  isAuthenticated: boolean;
};

const client = new KissRpc<ServerRpcMethods>({
  requestTimeout: 5000
});

// We are adding appData to the server instance.
// this will force us to pass appData to the registerHandler method and handleMessage.
// Typseript will make sure that you are following AppData interface.
const server = new KissRpc<ServerRpcMethods, ServerRpcMethods, User>({
  requestTimeout: 5000
});

client.registerToTransportCallback((message) => {
  // Let's assume that we are receiving user data from the transport layer.
  const user: User = { userId: '1', userRole: 'admin', isAuthenticated: true };
  server.fromTransport(message, user);
});

server.registerToTransportCallback((message) => {
	client.fromTransport(message);
});
// We are passing appData to the registerHandler method.
// Notice that we don't need to annotate this in ServerRpcMethods.
// But library will make sure to fore us to pass appData to the handleMessage method.
server.registerHandler('add', (a, b, user) => {
  // Error thrown from the handler will be returned as ErrorResult.
  if (!user.isAuthenticated) {
    throw new Error('User is not authenticated');
  }
  if (!user.userRole !== 'admin') {
    throw new Error('User is not affiliated');
  }	

  return a + b
});

const result = await client.request('add', [1, 2]);
```
## Handler Guards
KISS-RPC provides a way to protect your handlers from being executed. This can be seen as a middleware for the handlers.
Each handler can have one or more guards. Guards are functions that are executed before the handler. If any of the guards returns false, the handler will not be executed. Guards are executed in the order they are registered.
There are three types of guards:
- **Guard** - a function callback function that will be called with params and appData.
- **ParamGuard** - a function callback function that will be called with params only.
- **AppDataGuard** - a function callback function that will be called with appData only.
If any of guards throws an error, the error will be returned as ErrorResult, and handler will not be executed.

Guards can also be used as interceptors, can be useful for logging.
```typescript
type ServerRpcMethods = {
  add: (a: number, b: number) => number;
};

type User = {
  userId: string;
  userRole: string;
  isAuthenticated: boolean;
};

const client = new KissRpc<ServerRpcMethods>({
  requestTimeout: 5000
});

const server = new KissRpc<ServerRpcMethods, ServerRpcMethods, User>({
  requestTimeout: 5000
});

client.registerToTransportCallback((message) => {
  const user: User = { userId: '1', userRole: 'admin', isAuthenticated: true };
  server.fromTransport(message, user);
});

server.registerToTransportCallback((message) => {
  client.fromTransport(message);
});

function logRequest(a: number, b: number, user: User) {
  console.log(`User ${user.userId} is calling add method with params ${a} and ${b}`);
}

function validateParams(a: number, b: number) {
  if (params[0] < 0 || params[1] < 0) {
    throw new Error('Params must be positive');
  }
}

function validateUser(user: User) {
  if (!user.isAuthenticated) {
    throw new Error('User is not authenticated');
  }
  if (!user.userRole !== 'admin') {
    throw new Error('User is not affiliated');
  }
}

// registerHandler retuns an instance of handler, which can be used to register guards.
server.registerHandler('add', (a, b, user) => {
  return a + b
}).registerGuard(validateUser)
  .registerGuard(validateParams)
  .registerGuard(logRequest);

const result = await client.request('add', [1, 2]);
```