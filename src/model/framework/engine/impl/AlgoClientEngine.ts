import algosdk from 'algosdk';
import { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

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
    indexer: string;
    api_limits: IRateLimiterOptions;
};
// const pureStakeApi = {
//     main: 'https://mainnet-algorand.api.purestake.io/ps2',
//     indexer: 'https://mainnet-algorand.api.purestake.io/idx2',
// };
const ALGONODE_API: AlgoApiDefaults = {
    indexer: 'https://mainnet-idx.algonode.cloud/',
    main: 'https://mainnet-api.algonode.cloud/',
    api_limits: {
        points: 1,
        duration: 1,
    },
};
const ALGO_API_DEFAULTS: AlgoApiDefaults = ALGONODE_API;

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
    private readonly limiter: RateLimiterQueue;
    public readonly algoApiMaxResults: number = 1000;
    protected constructor() {
        this.algodConnection = AlgoClientEngine.getAlgodConnectionConfiguration();
        this.indexerConnection = AlgoClientEngine.getIndexerConnectionConfiguration();
        this.limiter = AlgoClientEngine.setupLimiter(this.indexerConnection.server);
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
        AlgoClientEngine.logConnectionTypes();
    }
    protected async rateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
        return await this.limiter
            .removeTokens(1)
            .then(() => {
                return request();
            })
            .catch(() => {
                throw new Error('Queue is full');
            });
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

        const algodServer = this.algodServer || ALGO_API_DEFAULTS.main;
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

        const indexerServer = this.indexerServer || ALGO_API_DEFAULTS.indexer;
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
    private static setupLimiter(indexerServer: string): RateLimiterQueue {
        let algoApiLimits = ALGO_API_DEFAULTS.api_limits;
        if (indexerServer.includes('purestake')) {
            algoApiLimits = {
                points: 9,
                duration: 1,
            };
        } else if (indexerServer.includes('algonode')) {
            algoApiLimits = {
                points: 50,
                duration: 1,
            };
        }
        logger.info(`Algo API Limits: ${JSON.stringify(algoApiLimits)}`);
        return new RateLimiterQueue(new RateLimiterMemory(algoApiLimits));
    }
}
