import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';
import { singleton } from 'tsyringe';

import logger from '../../../utils/functions/LoggerFactory.js';
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
        maxQueueSize: 20_000,
    });

    public async getWalletFromDiscordID(discordID: string): Promise<Array<NFDRecord>> {
        try {
            await this.limiterQueue.removeTokens(1);
            const response = await this.api.get<Array<NFDRecord>>('nfd', {
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
    public async getFullOwnedByWallet(wallet: string): Promise<Array<NFDRecord>> {
        try {
            await this.limiterQueue.removeTokens(1);
            const response = await this.api.get<Array<NFDRecord>>('nfd', {
                params: {
                    owner: wallet,
                    limit: 200,
                    view: 'full',
                },
            });
            return response.data;
        } catch (error) {
            logger.error(`[x] ${error}`);
            return await Promise.reject(error);
        }
    }
    public async getWalletDomainNamesFromWallet(wallet: string): Promise<Array<string>> {
        const nfdResponse = await this.getFullOwnedByWallet(wallet);
        return nfdResponse.filter(nfdRecord => nfdRecord.name).map(nfdRecord => nfdRecord.name);
    }
    /**
     * Validates if a wallet is owned by a discordID
     * Returns true if the wallet is owned by the discordID
     * Returns false if the wallet is owned by another discordID
     *
     * @param {string} discordID
     * @param {string} wallet
     * @returns {*}  {Promise<boolean>}
     * @memberof NFDomainsManager
     */
    public async validateWalletFromDiscordID(discordID: string, wallet: string): Promise<boolean> {
        const nfdResponse = await this.getFullOwnedByWallet(wallet);
        const discordIds = nfdResponse
            .filter(nfdRecord => nfdRecord.properties?.verified?.discord)
            .map(nfdRecord => nfdRecord.properties?.verified?.discord);

        return discordIds.length === 0 || discordIds.includes(discordID);
    }
    public async getAllOwnerWalletsFromDiscordID(discordID: string): Promise<Array<string>> {
        const nfDResponse = await this.getWalletFromDiscordID(discordID);
        return Array.from(new Set(nfDResponse.flatMap(nfdRecord => nfdRecord.caAlgo || [])));
    }
}
