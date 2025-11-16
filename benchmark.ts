import { performance } from 'perf_hooks';
import { KissRpc, KissRpcWithAppData, createRequest, createResponse, createErrorResponse, createNotification, parseMessage } from './index';

interface BenchmarkResult {
    name: string;
    operations: number;
    duration: number;
    opsPerSecond: number;
    avgLatency: number;
}

function formatNumber(num: number): string {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function printResult(result: BenchmarkResult) {
    console.log(`\n${result.name}`);
    console.log(`  Operations: ${formatNumber(result.operations)}`);
    console.log(`  Duration: ${formatNumber(result.duration)}ms`);
    console.log(`  Throughput: ${formatNumber(result.opsPerSecond)} ops/sec`);
    console.log(`  Avg Latency: ${formatNumber(result.avgLatency)}ms`);
}

function printHeader(text: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${text}`);
    console.log(`${'='.repeat(60)}`);
}

// Benchmark 1: Request-Response Round Trip Latency
async function benchmarkRequestResponseLatency(): Promise<BenchmarkResult> {
    type Methods = {
        add: (a: number, b: number) => number;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('add', (a, b, appData) => a + b);

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await client.request('add', [i, i + 1]);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Request-Response Round Trip',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 2: Notification Throughput
async function benchmarkNotificationThroughput(): Promise<BenchmarkResult> {
    type Methods = {
        notify: (value: number) => void;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };
    let receivedCount = 0;

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerHandler('notify', () => {
        receivedCount++;
    });

    const iterations = 50000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        client.notify('notify', [i]);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Notification Throughput',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 3: Message Serialization/Parsing
function benchmarkSerialization(): BenchmarkResult {
    const iterations = 100000;
    const testMessages = [
        createRequest('test.method', [1, 2, 3]),
        createResponse(123, { result: 'success', data: [1, 2, 3, 4, 5] }),
        createErrorResponse(456, 1001, 'Error message', 'Stack trace'),
        createNotification('notify.event', ['param1', 'param2'])
    ];

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        const message = testMessages[i % testMessages.length];
        const serialized = JSON.stringify(message);
        parseMessage(serialized);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Message Serialization + Parsing',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 4: Handler with Guards
async function benchmarkGuardOverhead(): Promise<BenchmarkResult> {
    type Methods = {
        secureAdd: (a: number, b: number) => number;
    };

    type AppData = {
        userId: string;
        authenticated: boolean;
    };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { userId: 'user123', authenticated: true };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    // Add handler with multiple guards
    server.registerHandler('secureAdd', (a, b, appData) => {
        return a + b;
    })
        .addAppDataGuard((appData) => {
            if (!appData.authenticated) throw new Error('Not authenticated');
        })
        .addParamsGuard((a, b) => {
            if (typeof a !== 'number' || typeof b !== 'number') throw new Error('Invalid params');
        })
        .addGuard((a, b, appData) => {
            if (appData.userId.length === 0) throw new Error('Invalid user');
        });

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await client.request('secureAdd', [i, i + 1]);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Request with Multiple Guards',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 5: Handler without Guards (for comparison)
async function benchmarkNoGuards(): Promise<BenchmarkResult> {
    type Methods = {
        add: (a: number, b: number) => number;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('add', (a, b, appData) => a + b);

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await client.request('add', [i, i + 1]);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Request without Guards (baseline)',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 6: Complex Object Serialization
async function benchmarkComplexObjects(): Promise<BenchmarkResult> {
    type Methods = {
        processData: (data: any) => any;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('processData', (data, appData) => data);

    const complexObject = {
        id: 12345,
        name: 'Test Object',
        nested: {
            array: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            map: { key1: 'value1', key2: 'value2', key3: 'value3' }
        },
        list: ['item1', 'item2', 'item3', 'item4', 'item5']
    };

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await client.request('processData', [complexObject]);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Complex Object Round Trip',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 7: Async Handler Performance
async function benchmarkAsyncHandlers(): Promise<BenchmarkResult> {
    type Methods = {
        asyncAdd: (a: number, b: number) => Promise<number>;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('asyncAdd', async (a, b, appData) => {
        return Promise.resolve(a + b);
    });

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await client.request('asyncAdd', [i, i + 1]);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: 'Async Handler Round Trip',
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 8: Concurrent Requests
async function benchmarkConcurrentRequests(): Promise<BenchmarkResult> {
    type Methods = {
        compute: (value: number) => number;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('compute', (value, appData) => value * 2);

    const iterations = 1000;
    const concurrency = 10;

    const start = performance.now();

    const promises: Promise<any>[] = [];
    for (let i = 0; i < iterations; i++) {
        promises.push(client.request('compute', [i]));

        if (promises.length >= concurrency) {
            await Promise.race(promises.map(p => p.then(() => true).catch(() => true)));
            promises.splice(0, 1);
        }
    }

    await Promise.all(promises);

    const end = performance.now();
    const duration = end - start;

    return {
        name: `Concurrent Requests (${concurrency} parallel)`,
        operations: iterations,
        duration,
        opsPerSecond: (iterations / duration) * 1000,
        avgLatency: duration / iterations
    };
}

// Benchmark 9: High Concurrency Stress Test
async function benchmarkHighConcurrency(concurrency: number): Promise<BenchmarkResult> {
    type Methods = {
        compute: (value: number) => number;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('compute', (value, appData) => value * 2);

    const start = performance.now();

    // Launch all requests concurrently
    const promises: Promise<number>[] = [];
    for (let i = 0; i < concurrency; i++) {
        promises.push(client.request('compute', [i]));
    }

    await Promise.all(promises);

    const end = performance.now();
    const duration = end - start;

    return {
        name: `High Concurrency (${concurrency.toLocaleString()} parallel)`,
        operations: concurrency,
        duration,
        opsPerSecond: (concurrency / duration) * 1000,
        avgLatency: duration / concurrency
    };
}

// Benchmark 10: Very High Concurrency with Batching
async function benchmarkMassiveConcurrency(): Promise<BenchmarkResult> {
    type Methods = {
        compute: (value: number) => number;
    };

    type AppData = { sessionId: string };

    const client = new KissRpc<Methods>({ requestTimeout: 60000 });
    const server = new KissRpcWithAppData<AppData, Methods, Methods>({ requestTimeout: 60000 });

    const appData: AppData = { sessionId: 'bench-session' };

    client.registerToTransportCallback((message) => {
        server.fromTransport(message, appData);
    });

    server.registerToTransportCallback((message, appData) => {
        client.fromTransport(message);
    });

    server.registerHandler('compute', (value, appData) => value * 2);

    const totalRequests = 10000;
    const batchSize = 1000;

    const start = performance.now();

    for (let batch = 0; batch < totalRequests / batchSize; batch++) {
        const promises: Promise<number>[] = [];
        for (let i = 0; i < batchSize; i++) {
            promises.push(client.request('compute', [batch * batchSize + i]));
        }
        await Promise.all(promises);
    }

    const end = performance.now();
    const duration = end - start;

    return {
        name: `Massive Concurrency (${totalRequests.toLocaleString()} total, ${batchSize} per batch)`,
        operations: totalRequests,
        duration,
        opsPerSecond: (totalRequests / duration) * 1000,
        avgLatency: duration / totalRequests
    };
}

// Main benchmark runner
async function runBenchmarks() {
    console.log('\nKISS-RPC Performance Benchmark Suite');
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);

    const results: BenchmarkResult[] = [];

    printHeader('Basic Performance');
    results.push(benchmarkSerialization());
    printResult(results[results.length - 1]);

    results.push(await benchmarkRequestResponseLatency());
    printResult(results[results.length - 1]);

    results.push(await benchmarkNotificationThroughput());
    printResult(results[results.length - 1]);

    printHeader('Handler Performance');
    results.push(await benchmarkNoGuards());
    printResult(results[results.length - 1]);

    results.push(await benchmarkAsyncHandlers());
    printResult(results[results.length - 1]);

    results.push(await benchmarkGuardOverhead());
    printResult(results[results.length - 1]);

    printHeader('Advanced Scenarios');
    results.push(await benchmarkComplexObjects());
    printResult(results[results.length - 1]);

    results.push(await benchmarkConcurrentRequests());
    printResult(results[results.length - 1]);

    printHeader('High Concurrency Stress Tests');
    console.log('Testing linear iteration overhead in timeout checker...\n');

    // Test with increasing concurrency levels
    results.push(await benchmarkHighConcurrency(100));
    printResult(results[results.length - 1]);

    results.push(await benchmarkHighConcurrency(500));
    printResult(results[results.length - 1]);

    results.push(await benchmarkHighConcurrency(1000));
    printResult(results[results.length - 1]);

    results.push(await benchmarkHighConcurrency(2500));
    printResult(results[results.length - 1]);

    results.push(await benchmarkHighConcurrency(5000));
    printResult(results[results.length - 1]);

    results.push(await benchmarkMassiveConcurrency());
    printResult(results[results.length - 1]);

    printHeader('Summary');
    console.log('\nAll benchmarks completed!\n');

    // Guard overhead calculation
    const noGuardsResult = results.find(r => r.name.includes('without Guards'));
    const guardsResult = results.find(r => r.name.includes('with Multiple Guards'));

    if (noGuardsResult && guardsResult) {
        const overhead = ((guardsResult.avgLatency - noGuardsResult.avgLatency) / noGuardsResult.avgLatency) * 100;
        console.log(`Guard overhead: ${formatNumber(overhead)}% (${formatNumber(guardsResult.avgLatency - noGuardsResult.avgLatency)}ms per request)`);
    }

    // Concurrency scaling analysis
    console.log('\nConcurrency Scaling Analysis:');
    const concurrencyResults = results.filter(r => r.name.includes('High Concurrency'));
    if (concurrencyResults.length > 0) {
        console.log('Requests | Throughput (ops/sec) | Avg Latency (ms)');
        console.log('---------|---------------------|------------------');
        concurrencyResults.forEach(r => {
            const count = r.operations.toString().padStart(8);
            const throughput = formatNumber(r.opsPerSecond).padStart(19);
            const latency = formatNumber(r.avgLatency).padStart(18);
            console.log(`${count} | ${throughput} | ${latency}`);
        });
    }

    console.log('\n');
}

// Run benchmarks
runBenchmarks().catch(console.error);
