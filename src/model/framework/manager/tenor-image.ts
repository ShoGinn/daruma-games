import { injectable, singleton } from 'tsyringe';

import { getConfig } from '../../../config/config.js';
import { imageHosting } from '../../../utils/functions/dt-images.js';
import logger from '../../../utils/functions/logger-factory.js';
import { AbstractRequestEngine } from '../engine/impl/abstract-request-engine.js';

interface TenorApiResponse {
	results: Array<{ media_formats: { tinygif: { url: string } } }>;
}
const config = getConfig();
@injectable()
@singleton()
export class TenorImageManager extends AbstractRequestEngine {
	private static token: string;
	public constructor() {
		TenorImageManager.token = config.get('tenorApiKey') || '';
		super('https://tenor.googleapis.com/v2/search', {
			params: {
				key: TenorImageManager.token,
				client_key: 'daruma',
			},
		});
	}
	public async fetchRandomTenorGif(search: string): Promise<string> {
		if (!TenorImageManager.token) {
			// Return the static URL if TENOR_API_KEY is not set
			return imageHosting.failedImage;
		}
		return await this.rateLimitedRequest(async () => {
			const { data } = await this.apiFetch<TenorApiResponse>('', {
				params: {
					q: search,
					media_filter: 'tinygif',
					random: true,
					limit: 1,
				},
			});
			const firstResult = data.results?.[0];
			return firstResult
				? firstResult.media_formats.tinygif.url
				: imageHosting.failedImage;
		}).catch((error) => {
			logger.error(`[x] ${JSON.stringify(error)}`);
			throw error;
		});
	}
}
