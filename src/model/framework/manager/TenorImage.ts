import { singleton } from 'tsyringe';

import { imageHosting } from '../../../utils/functions/dtImages.js';
import logger from '../../../utils/functions/LoggerFactory.js';
import { Property } from '../decorators/Property.js';
import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';

@singleton()
export class TenorImageManager extends AbstractRequestEngine {
    @Property('TENOR_API_KEY')
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
        return await this.rateLimitedRequest(async () => {
            const { data } = await this.api.get('', {
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
