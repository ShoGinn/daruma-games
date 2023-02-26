import algosdk from 'algosdk';
import type { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';
import { IRateLimiterOptions } from 'rate-limiter-flexible';

import logger from '../../../../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../../../../utils/Utils.js';
import { RateLimiter } from '../../../logic/rateLimiter.js';
import { SystemProperty } from '../../decorators/SystemProperty.js';
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
    @SystemProperty('CLAWBACK_TOKEN_MNEMONIC', true)
    static readonly clawBackTokenMnemonic: string;
    @SystemProperty('CLAIM_TOKEN_MNEMONIC', false)
    static readonly claimTokenMnemonic: string;

    @SystemProperty('ALGO_API_TOKEN', false)
    private static readonly algoApiToken: string;

    @SystemProperty('ALGOD_SERVER', false)
    private static readonly algodServer: string;

    @SystemProperty('ALGOD_PORT', false)
    private static readonly algodPort: string;

    @SystemProperty('INDEXER_SERVER', false)
    private static readonly indexerServer: string;

    @SystemProperty('INDEXER_PORT', false)
    private static readonly indexerPort: string;

    @SystemProperty('API_LIMITS_POINTS', false)
    private static readonly apiLimitsPoints: string;

    @SystemProperty('API_LIMITS_DURATION', false)
    private static readonly apiLimitsDuration: string;

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
        // cast apiLimits to number to avoid type error
        const apiLimits: IRateLimiterOptions = {
            points: this.apiLimitsPoints === '0' ? 0 : +this.apiLimitsPoints || 1,
            duration: this.apiLimitsDuration === '0' ? 0 : +this.apiLimitsDuration || 1,
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
