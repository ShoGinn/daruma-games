import { singleton } from 'tsyringe';

import { imageHosting } from '../../../utils/functions/dtImages.js';
import logger from '../../../utils/functions/LoggerFactory.js';
import { SystemProperty } from '../decorators/SystemProperty.js';
import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';

interface TenorApiResponse {
    results: Array<{ media_formats: { tinygif: { url: string } } }>;
}
@singleton()
export class TenorImageManager extends AbstractRequestEngine {
    @SystemProperty('TENOR_API_KEY', false)
    private static readonly token: string;

    public constructor() {
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
            return data.results?.length > 0
                ? data.results[0].media_formats.tinygif.url
                : imageHosting.failedImage;
        }).catch(error => {
            logger.error(`[x] ${error}`);
            return Promise.reject(error);
        });
    }
}
