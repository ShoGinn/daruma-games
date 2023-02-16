import logger from '../../../../../utils/functions/LoggerFactory.js';
import { clearPropertyCache } from '../../../decorators/Property.js';
import { AlgoClientEngine } from '../AlgoClientEngine.js';
jest.mock('../../../../../utils/functions/LoggerFactory.js', () => {
    return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
});
beforeEach(() => {
    (logger.error as jest.Mock).mockReset();
    (logger.warn as jest.Mock).mockReset();
    (logger.info as jest.Mock).mockReset();
});

describe('AlgoClientEngine', () => {
    class ClientForTesting extends AlgoClientEngine {
        constructor() {
            super();
        }
    }

    let _algoClientEngine: ClientForTesting;
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
            _algoClientEngine = new ClientForTesting();
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
            _algoClientEngine = new ClientForTesting();
        } catch (e) {
            expect(e).toHaveProperty('message', 'Algo API Token is required');
        }
    });

    it('logs the correct default connection types', () => {
        const mnemonic = 'clawback';

        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
        _algoClientEngine = new ClientForTesting();
        expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._points', 50);
        expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._duration', 1);

        expect(_algoClientEngine).toEqual(
            expect.objectContaining({
                algodConnection: {
                    server: 'https://mainnet-api.algonode.cloud/',
                    port: '',
                    token: '',
                },
                indexerConnection: {
                    server: 'https://mainnet-idx.algonode.cloud/',
                    port: '',
                    token: '',
                },
                algoApiMaxResults: 1000,
            })
        );
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual(mnemonic);
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
        _algoClientEngine = new ClientForTesting();
        expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._points', 1);
        expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._duration', 1);

        expect(_algoClientEngine).toEqual(
            expect.objectContaining({
                algodConnection: {
                    server: server,
                    port: '1234',
                    token: token,
                },
                indexerConnection: {
                    server: server,
                    port: '1234',
                    token: token,
                },
                algoApiMaxResults: 1000,
            })
        );
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual(mnemonic);
    });
    it('logs the correct connection types for purestake', () => {
        const token = 'token';
        const server = 'https://testnet-algorand.api.purestake.io/ps2';
        const mnemonic = 'clawback';
        process.env.ALGO_API_TOKEN = token;
        process.env.CLAWBACK_TOKEN_MNEMONIC = mnemonic;
        process.env.ALGOD_SERVER = server;
        process.env.INDEXER_SERVER = server;
        _algoClientEngine = new ClientForTesting();
        expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._points', 9);
        expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._duration', 1);

        expect(_algoClientEngine).toEqual(
            expect.objectContaining({
                algodConnection: {
                    server: server,
                    port: '',
                    token: {
                        'X-API-Key': token,
                    },
                },
                indexerConnection: {
                    server: server,
                    port: '',
                    token: {
                        'X-API-Key': token,
                    },
                },
                algoApiMaxResults: 1000,
            })
        );
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual(mnemonic);
    });
});
