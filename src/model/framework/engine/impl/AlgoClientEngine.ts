import algosdk from 'algosdk';
import { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';

import logger from '../../../../utils/functions/LoggerFactory.js';
import { Property } from '../../decorators/Property.js';
const { Indexer } = algosdk;

type AlgoConnection = {
    token: string | CustomTokenHeader;
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
    @Property('CLAWBACK_TOKEN_MNEMONIC', true)
    static readonly clawBackTokenMnemonic: string;
    @Property('CLAIM_TOKEN_MNEMONIC', false)
    static readonly claimTokenMnemonic: string;

    @Property('ALGO_API_TOKEN')
    private static readonly algoApiToken: string;

    @Property('ALGOD_SERVER', false)
    private static readonly algodServer: string;

    @Property('ALGOD_PORT', false)
    private static readonly algodPort: string;

    @Property('INDEXER_SERVER', false)
    private static readonly indexerServer: string;

    @Property('INDEXER_PORT', false)
    private static readonly indexerPort: string;

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
        const pureStakeApi: CustomTokenHeader = {
            'X-API-Key': this.algoApiToken,
        };

        const algodServer = this.algodServer || algoApiDefaults.main;
        const algodPort = this.algodPort ?? '';
        const algodToken = algodServer.includes('purestake.io') ? pureStakeApi : this.algoApiToken;
        return {
            token: algodToken,
            server: algodServer,
            port: algodPort,
        };
    }

    private static getIndexerConnectionConfiguration(): AlgoConnection {
        // Purestake uses a slightly different API key header than the default
        // We are using Purestake to talk to testnet and mainnet so we don't have to stand up our own node
        const pureStakeApi: CustomTokenHeader = {
            'X-API-Key': this.algoApiToken,
        };

        const indexerServer = this.indexerServer || algoApiDefaults.indexer;
        const indexerPort = this.indexerPort ?? '';
        const indexerToken = indexerServer.includes('purestake.io')
            ? pureStakeApi
            : this.algoApiToken;
        return {
            token: indexerToken,
            server: indexerServer,
            port: indexerPort,
        };
    }
}
