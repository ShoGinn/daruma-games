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
                media_filter: 'tinygif',
                random: true,
                limit: 1,
            },
        });
    }
    public async fetchRandomTenorGif(search: string): Promise<string> {
        try {
            const { data } = await this.api.get(null, {
                params: {
                    q: search,
                },
            });
            if (data.results.length > 0) {
                return data.results[0].media_formats.tinygif.url;
            }
            return imageHosting.failedImage;
        } catch (error) {
            logger.error(`[x] ${error}`);
            return imageHosting.failedImage;
        }
    }
}
