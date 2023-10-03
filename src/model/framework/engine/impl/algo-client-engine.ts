import algosdk from 'algosdk';
import type { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';
import { IRateLimiterOptions } from 'rate-limiter-flexible';

import { getConfig } from '../../../../config/config.js';
import { RateLimiter } from '../../../logic/rate-limiter.js';

const config = getConfig();

export abstract class AlgoClientEngine {
	protected algodClient: algosdk.Algodv2;
	protected indexerClient: algosdk.Indexer;
	protected limiter: RateLimiter;
	protected algoEngineConfig = config.get('algoEngineConfig');
	protected constructor() {
		this.limiter = this.setupLimiter();
		const token = this.setupApiToken();
		this.algodClient = new algosdk.Algodv2(
			token,
			this.algoEngineConfig.algod.server,
			this.algoEngineConfig.algod.port || '',
		);
		this.indexerClient = new algosdk.Indexer(
			token,
			this.algoEngineConfig.indexer.server,
			this.algoEngineConfig.indexer.port || '',
		);
	}
	protected async rateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
		return await this.limiter.execute(request);
	}
	private setupApiToken(): string | CustomTokenHeader {
		const apiToken = this.algoEngineConfig.algoApiToken;
		const { server } = this.algoEngineConfig.algod;
		// Algonode does not require an API token
		// If you do have one, it will be used.
		if (server.includes('algonode')) {
			return apiToken || '';
		}
		// All other servers require an API token
		if (!apiToken) {
			throw new Error('Algo API Token is required');
		}
		// Purestake requires a custom header
		return server.includes('purestake')
			? ({ 'X-API-Key': apiToken } as CustomTokenHeader)
			: apiToken;
	}
	private setupLimiter(): RateLimiter {
		return new RateLimiter(
			this.algoEngineConfig.apiLimits as IRateLimiterOptions,
		);
	}
}
