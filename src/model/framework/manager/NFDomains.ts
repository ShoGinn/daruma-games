import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';
import { singleton } from 'tsyringe';

import logger from '../../../utils/functions/LoggerFactory.js';
import { Typeings } from '../../Typeings.js';
import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';

@singleton()
export class NFDomainsManager extends AbstractRequestEngine {
    public constructor() {
        super('https://api.nf.domains/');
    }
    //? rate limiter to prevent hitting the rate limit of the api
    private limiterFlexible = new RateLimiterMemory({
        points: 1,
        duration: 1,
    });
    public limiterQueue = new RateLimiterQueue(this.limiterFlexible, {
        maxQueueSize: 20000,
    });

    public async getWalletFromDiscordID(discordID: string): Promise<Typeings.NfdRecord[]> {
        try {
            const response = await this.api.get<Typeings.NfdRecord[]>('nfd', {
                params: {
                    vproperty: 'discord',
                    vvalue: discordID,
                },
            });
            return response.data;
        } catch (error) {
            logger.error(`[x] ${error}`);
            return await Promise.reject(error);
        }
    }
    public async getAllOwnerWalletsFromDiscordID(discordID: string): Promise<string[]> {
        await this.limiterQueue.removeTokens(1);
        const nfDResponse = await this.getWalletFromDiscordID(discordID);
        const nfdOwnerWallets: string[] = [];
        for (const nfdRecord of nfDResponse) {
            if (nfdRecord.owner) {
                nfdOwnerWallets.push(nfdRecord.owner);
            }
        }
        // remove duplicates
        return [...new Set(nfdOwnerWallets)];
    }
}
