import { AlgoClientEngine } from '../AlgoClientEngine.js';

describe('AlgoClientEngine', () => {
    class ClientForTesting extends AlgoClientEngine {
        constructor() {
            super();
        }
    }

    let _algoClientEngine: ClientForTesting;
    afterEach(() => {
        jest.resetModules();
    });
    it('errors out when the clawback token is not set', () => {
        let error;
        try {
            _algoClientEngine = new ClientForTesting();
        } catch (e) {
            error = e;
        }

        expect(error).toHaveProperty(
            'message',
            'Unable to find prop with key "CLAWBACK_TOKEN_MNEMONIC"'
        );
    });

    it('logs the correct connection types', () => {
        process.env.CLAWBACK_TOKEN_MNEMONIC = 'clawback';
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
        expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual('clawback');
    });
    // it('logs the correct connection types', () => {
    //     process.env.CLAWBACK_TOKEN_MNEMONIC = 'nope';
    //     process.env.ALGOD_SERVER = 'https://testnet-api.algoexplorer.io';
    //     _algoClientEngine = new ClientForTesting();
    //     expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._points', 50);
    //     expect(_algoClientEngine).toHaveProperty('limiter._limiterFlexible._duration', 1);

    //     expect(_algoClientEngine).toEqual(
    //         expect.objectContaining({
    //             algodConnection: {
    //                 server: 'https://mainnet-api.algonode.cloud/',
    //                 port: '',
    //                 token: '',
    //             },
    //             indexerConnection: {
    //                 server: 'https://mainnet-idx.algonode.cloud/',
    //                 port: '',
    //                 token: '',
    //             },
    //             algoApiMaxResults: 1000,
    //         })
    //     );
    //     expect(AlgoClientEngine.clawBackTokenMnemonic).toEqual('nope');
    // });
});
