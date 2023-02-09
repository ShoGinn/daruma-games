import algosdk from 'algosdk';
import { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

import logger from '../../../../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../../../../utils/Utils.js';
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

    @Property('ALGO_API_TOKEN', false)
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
        const clawBack = ObjectUtil.ellipseAddress(this.clawBackTokenMnemonic, 1, 1);
        const token = ObjectUtil.ellipseAddress(this.algoApiToken, 1, 1);
        const connectionConfig = {
            algoServer: AlgoClientEngine.getAlgodConnectionConfiguration().server,
            algoPort: AlgoClientEngine.getAlgodConnectionConfiguration().port,
            indexerServer: AlgoClientEngine.getIndexerConnectionConfiguration().server,
            indexerPort: AlgoClientEngine.getIndexerConnectionConfiguration().port,
            clawBackToken: clawBack,
            algoApiToken: token,
        };

        logger.info(`Connection Config: ${JSON.stringify(connectionConfig)}`);
    }
    private static getAlgodConnectionConfiguration(): AlgoConnection {
        const server = this.algodServer || ALGO_API_DEFAULTS.main;
        const token = AlgoClientEngine.setupApiToken(server);
        return {
            server: server,
            port: this.algodPort || '',
            token: token,
        };
    }
    private static getIndexerConnectionConfiguration(): AlgoConnection {
        const server = this.indexerServer || ALGO_API_DEFAULTS.indexer;
        const token = AlgoClientEngine.setupApiToken(server);
        return {
            server: server,
            port: this.indexerPort || '',
            token: token,
        };
    }
    private static setupApiToken(server: string): string | CustomTokenHeader {
        if (!server.includes('algonode') && !this.algoApiToken) {
            throw new Error('Algo API Token is required');
        }
        return server.includes('purestake')
            ? ({ 'X-API-Key': this.algoApiToken } as CustomTokenHeader)
            : this.algoApiToken || '';
    }
    private static setupLimiter(indexerServer: string): RateLimiterQueue {
        const limits = indexerServer.includes('purestake')
            ? { points: 9, duration: 1 }
            : indexerServer.includes('algonode')
            ? { points: 50, duration: 1 }
            : ALGO_API_DEFAULTS.api_limits;

        logger.info(`Algo API Limits: ${JSON.stringify(limits)}`);
        return new RateLimiterQueue(new RateLimiterMemory(limits));
    }
}
