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
            await this.limiterQueue.removeTokens(1);
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
    public async getFullOwnedByWallet(wallet: string): Promise<Typeings.NfdRecord[]> {
        try {
            await this.limiterQueue.removeTokens(1);
            const response = await this.api.get<Typeings.NfdRecord[]>('nfd', {
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
    public async getWalletDomainNamesFromWallet(wallet: string): Promise<string[]> {
        const nfdResponse = await this.getFullOwnedByWallet(wallet);
        // check for name property in nfdResponse
        const nfdDomainNames: string[] = [];
        for (const nfdRecord of nfdResponse) {
            if (nfdRecord.name) {
                nfdDomainNames.push(nfdRecord.name);
            }
        }
        return nfdDomainNames;
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
        // header csv header for logging
        // verified, nf-domain, discordID, wallet, verified-discord-id
        const nfdResponse = await this.getFullOwnedByWallet(wallet);
        // if discordId is in the response array return true
        if (nfdResponse.length > 0) {
            for (const nfdRecord of nfdResponse) {
                if (nfdRecord?.properties?.verified?.discord === discordID) {
                    // User is a verified user with a discordID registered --> return true
                    return true;
                } else if (nfdRecord?.properties?.verified?.discord === undefined) {
                    // Wallet has a domain but no discordID registered --> return true
                    return true;
                } else {
                    // Wallet has a domain but discordID is not the same --> return false
                    return false;
                }
            }
        } else {
            // no domains found for wallet --> return true
            return true;
        }
    }
    public async getAllOwnerWalletsFromDiscordID(discordID: string): Promise<string[]> {
        const nfDResponse = await this.getWalletFromDiscordID(discordID);
        const nfdOwnerWallets: string[] = [];
        for (const nfdRecord of nfDResponse) {
            if (nfdRecord.caAlgo) {
                // loop through caAlgo
                for (const caAlgo of nfdRecord.caAlgo) {
                    nfdOwnerWallets.push(caAlgo);
                }
            }
        }
        // remove duplicates
        return [...new Set(nfdOwnerWallets)];
    }
}
