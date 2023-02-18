import { clearPropertyCache } from '../../src/model/framework/decorators/Property.js';
import { AlgoClientEngine } from '../../src/model/framework/engine/impl/AlgoClientEngine.js';
import { RateLimiter } from '../../src/model/logic/rateLimiter.js';

class ClientForTesting extends AlgoClientEngine {
    constructor() {
        super();
    }
    public testRateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
        return this.rateLimitedRequest(request);
    }

    _checkLimiter(): RateLimiter {
        return this.limiter;
    }
    _getAlgodClient(): any {
        return this.algodClient;
    }
    _getIndexerClient(): any {
        return this.indexerClient;
    }
}
describe('AlgoClientEngine', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        jest.resetModules();
        clearPropertyCache();
        process.env = { ...OLD_ENV };
    });
    afterEach(() => {
        process.env = OLD_ENV;
    });
    it('errors out when the clawback token is not set', () => {
        expect.assertions(1);

        try {
            const _algoClientEngine = new ClientForTesting();
        } catch (e) {
            expect(e).toHaveProperty(
                'message',
                'Unable to find prop with key "CLAWBACK_TOKEN_MNEMONIC"'
            );
        }
    });
    it('throw error when api is not given', () => {
        expect.assertions(1);
        const server = 'https://testnet-api.algoexplorer.io';
        const mnemonic = 'clawback';
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
        process.env.ALGOD_SERVER = server;
        process.env.INDEXER_SERVER = server;
        process.env.INDEXER_PORT = '1234';
        process.env.ALGOD_PORT = '1234';
        try {
            const _algoClientEngine = new ClientForTesting();
        } catch (e) {
            expect(e).toHaveProperty('message', 'Algo API Token is required');
        }
    });

    it('logs the correct default connection types', () => {
        const mnemonic = 'clawback';
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;

        const _algoClientEngine = new ClientForTesting();
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual(mnemonic);

        const algodClient = _algoClientEngine._getAlgodClient();
        const indexerClient = _algoClientEngine._getIndexerClient();
        expect(algodClient.c.bc.baseURL.toString()).toMatch('https://mainnet-api.algonode.cloud/');
        expect(indexerClient.c.bc.baseURL.toString()).toMatch(
            'https://mainnet-idx.algonode.cloud/'
        );
        expect(algodClient.c.bc).toMatchObject({
            baseURL: expect.any(URL),
            defaultHeaders: {},
            tokenHeader: {
                'X-Algo-API-Token': '',
            },
        });
        expect(indexerClient.c.bc).toMatchObject({
            baseURL: expect.any(URL),
            defaultHeaders: {},
            tokenHeader: {
                'X-Indexer-API-Token': '',
            },
        });

        const limiter = _algoClientEngine._checkLimiter();
        expect(limiter).toHaveProperty('limiter._limiterFlexible._points', 50);
        expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', 1);
    });
    it('logs the correct connection types for none-purestake', () => {
        const token = 'token';
        const server = 'https://testnet-api.algoexplorer.io';
        const mnemonic = 'clawback';
        process.env.ALGO_API_TOKEN = token;
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
        process.env.ALGOD_SERVER = server;
        process.env.INDEXER_SERVER = server;
        process.env.INDEXER_PORT = '1234';
        process.env.ALGOD_PORT = '1234';

        const _algoClientEngine = new ClientForTesting();
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual(mnemonic);

        const algodClient = _algoClientEngine._getAlgodClient();
        const indexerClient = _algoClientEngine._getIndexerClient();
        expect(algodClient.c.bc.baseURL.toString()).toMatch(server);
        expect(indexerClient.c.bc.baseURL.toString()).toMatch(server);
        expect(algodClient.c.bc).toMatchObject({
            baseURL: expect.any(URL),
            defaultHeaders: {},
            tokenHeader: {
                'X-Algo-API-Token': token,
            },
        });
        expect(indexerClient.c.bc).toMatchObject({
            baseURL: expect.any(URL),
            defaultHeaders: {},
            tokenHeader: {
                'X-Indexer-API-Token': token,
            },
        });

        const limiter = _algoClientEngine._checkLimiter();
        expect(limiter).toHaveProperty('limiter._limiterFlexible._points', 1);
        expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', 1);
    });
    it('logs the correct connection types for purestake', () => {
        const token = 'token';
        const server = 'https://testnet-algorand.api.purestake.io/ps2';
        const mnemonic = 'clawback';
        process.env.ALGO_API_TOKEN = token;
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
        process.env.ALGOD_SERVER = server;
        process.env.INDEXER_SERVER = server;

        const _algoClientEngine = new ClientForTesting();
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual(mnemonic);

        const algodClient = _algoClientEngine._getAlgodClient();
        const indexerClient = _algoClientEngine._getIndexerClient();
        expect(algodClient.c.bc.baseURL.toString()).toMatch(server);
        expect(indexerClient.c.bc.baseURL.toString()).toMatch(server);
        expect(algodClient.c.bc).toMatchObject({
            baseURL: expect.any(URL),
            defaultHeaders: {},
            tokenHeader: {
                'X-API-Key': token,
            },
        });
        expect(indexerClient.c.bc).toMatchObject({
            baseURL: expect.any(URL),
            defaultHeaders: {},
            tokenHeader: {
                'X-API-Key': token,
            },
        });

        const limiter = _algoClientEngine._checkLimiter();
        expect(limiter).toHaveProperty('limiter._limiterFlexible._points', 9);
        expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', 1);
    });
    it('successfully runs a RateLimitedRequest', async () => {
        const mnemonic = 'clawback';
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;

        const api = new ClientForTesting();
        const mockRequest = jest.fn(() => Promise.resolve('response'));
        await expect(api.testRateLimitedRequest(mockRequest)).resolves.toBe('response');
    });

    it('limits the rate of requests', async () => {
        const token = 'token';
        const server = 'https://testnet-api.algoexplorer.io';
        const mnemonic = 'clawback';
        process.env.ALGO_API_TOKEN = token;
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
        process.env.ALGOD_SERVER = server;
        process.env.INDEXER_SERVER = server;
        process.env.INDEXER_PORT = '1234';
        process.env.ALGOD_PORT = '1234';
        process.env.API_LIMITS_POINTS = '0';

        const _algoClientEngine = new ClientForTesting();

        const limiter = _algoClientEngine._checkLimiter();
        expect(limiter).toHaveProperty('limiter._limiterFlexible._points', 0);
        expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', 1);

        const mockRequest = jest.fn(() => Promise.resolve('response'));

        await expect(_algoClientEngine.testRateLimitedRequest(mockRequest)).rejects.toThrow(
            'Queue is full'
        );
    });
});
