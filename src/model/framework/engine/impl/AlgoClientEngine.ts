import algosdk from 'algosdk';
import { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';
import { IRateLimiterOptions } from 'rate-limiter-flexible';

import logger from '../../../../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../../../../utils/Utils.js';
import { RateLimiter } from '../../../logic/rateLimiter.js';
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
};
// const pureStakeApi = {
//     main: 'https://mainnet-algorand.api.purestake.io/ps2',
//     indexer: 'https://mainnet-algorand.api.purestake.io/idx2',
// };
const ALGONODE_API: AlgoApiDefaults = {
    indexer: 'https://mainnet-idx.algonode.cloud/',
    main: 'https://mainnet-api.algonode.cloud/',
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
    private readonly algodConnection: AlgoConnection =
        AlgoClientEngine.getAlgodConnectionConfiguration();
    private readonly indexerConnection: AlgoConnection =
        AlgoClientEngine.getIndexerConnectionConfiguration();
    protected readonly limiter: RateLimiter;
    protected readonly algoApiMaxResults: number = 1000;
    protected constructor() {
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
        return await this.limiter.execute(request);
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
    private static setupLimiter(indexerServer: string): RateLimiter {
        const defaultPoints =
            process.env.API_LIMITS_POINTS === '0' ? 0 : +process.env.API_LIMITS_POINTS || 1;
        const defaultDuration =
            process.env.API_LIMITS_DURATION === '0' ? 0 : +process.env.API_LIMITS_DURATION || 1;
        const apiLimits: IRateLimiterOptions = {
            points: defaultPoints,
            duration: defaultDuration,
        };

        let limits = apiLimits;
        if (indexerServer.includes('purestake')) {
            limits = { points: 9, duration: 1 };
        } else if (indexerServer.includes('algonode')) {
            limits = { points: 50, duration: 1 };
        }

        logger.info('Algo API Limits:', limits);
        return new RateLimiter(limits);
    }
}
