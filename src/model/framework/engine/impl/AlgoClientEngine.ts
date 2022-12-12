import algosdk from 'algosdk';

import logger from '../../../../utils/functions/LoggerFactory.js';
const { Indexer } = algosdk;

type pureStakeApi = {
    'X-API-Key': string;
};
type AlgoConnection = {
    token: string | pureStakeApi;
    server: string;
    port: string;
};
type AlgoApiDefaults = {
    main: string;
    test: string;
    indexer: string;
    max_api_resources: number;
};
const algoApiDefaults = {
    main: 'https://mainnet-algorand.api.purestake.io/ps2',
    test: 'https://testnet-algorand.api.purestake.io/ps2',
    indexer: 'https://mainnet-algorand.api.purestake.io/idx2',
    max_api_resources: 1000,
};

export abstract class AlgoClientEngine {
    protected readonly algodClient: algosdk.Algodv2;
    protected readonly indexerClient: algosdk.Indexer;
    private readonly algodConnection: AlgoConnection;
    private readonly indexerConnection: AlgoConnection;
    public readonly algoApiDefaults: AlgoApiDefaults;
    protected constructor() {
        this.algodConnection = AlgoClientEngine.getAlgodConnectionConfiguration();
        this.indexerConnection = AlgoClientEngine.getIndexerConnectionConfiguration();
        this.algodClient = new algosdk.Algodv2(
            this.algodConnection.token,
            this.algodConnection.server,
            this.algodConnection.port
        );
        this.indexerClient = new Indexer(
            this.indexerConnection.token,
            this.indexerConnection.server,
            this.indexerConnection.port
        );
        this.algoApiDefaults = algoApiDefaults;
        AlgoClientEngine.logConnectionTypes();
    }
    private static logConnectionTypes(): void {
        logger.info(
            `AlgoConnection Server: ${AlgoClientEngine.getAlgodConnectionConfiguration().server}`
        );
        logger.info(
            `IndexerConnection: ${AlgoClientEngine.getIndexerConnectionConfiguration().server}`
        );
    }
    private static getAlgodConnectionConfiguration(): AlgoConnection {
        // Purestake uses a slightly different API key header than the default
        // We are using Purestake to talk to testnet and mainnet so we don't have to stand up our own node
        const pureStakeApi: pureStakeApi = {
            'X-API-Key': process.env.ALGO_PURESTAKE_API_TOKEN,
        };

        const algodServer = process.env.ALGOD_SERVER || algoApiDefaults.main;
        const algodPort = process.env.ALGOD_PORT ?? '';
        const algodToken = algodServer.includes('purestake.io')
            ? pureStakeApi
            : process.env.ALGOD_TOKEN;
        return {
            token: algodToken,
            server: algodServer,
            port: algodPort,
        };
    }

    private static getIndexerConnectionConfiguration(): AlgoConnection {
        // Purestake uses a slightly different API key header than the default
        // We are using Purestake to talk to testnet and mainnet so we don't have to stand up our own node
        const pureStakeApi: pureStakeApi = {
            'X-API-Key': process.env.ALGO_PURESTAKE_API_TOKEN,
        };

        const indexerServer = process.env.INDEXER_SERVER || algoApiDefaults.indexer;
        const indexerPort = process.env.INDEXER_PORT ?? '';
        const indexerToken = indexerServer.includes('purestake.io')
            ? pureStakeApi
            : process.env.INDEXER_TOKEN;
        return {
            token: indexerToken,
            server: indexerServer,
            port: indexerPort,
        };
    }
}
