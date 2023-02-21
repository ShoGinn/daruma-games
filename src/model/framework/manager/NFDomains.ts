import { singleton } from 'tsyringe';

import logger from '../../../utils/functions/LoggerFactory.js';
import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';

@singleton()
export class NFDomainsManager extends AbstractRequestEngine {
    public constructor() {
        super('https://api.nf.domains/');
    }
    /**
     * Retrieves all NFD records for a given Discord ID.
     *
     * @param {string} discordID - The Discord ID to retrieve records for.
     * @returns {Promise<Array<NFDRecord>>} A promise that resolves to an array of NFD records.
     * @throws {Error} If an error occurs while making the request.
     */
    public async getNFDRecordsOwnedByDiscordID(discordID: string): Promise<Array<NFDRecord>> {
        return await this.rateLimitedRequest(async () => {
            const response = await this.apiFetch<Array<NFDRecord>>('nfd', {
                params: {
                    vproperty: 'discord',
                    vvalue: discordID,
                },
            });
            return response.data;
        }).catch(error => {
            logger.error(`[x] ${error}`);
            return Promise.reject(error);
        });
    }
    /**
     * Returns an array of unique wallet addresses owned by a given Discord user.
     *
     * @param {string} discordID - The ID of the Discord user to search for.
     * @returns {Promise<Array<string>>} - An array of unique wallet addresses owned by the specified Discord user.
     * @memberof NFDomainsManager
     */
    public async getAllOwnerWalletsFromDiscordID(discordID: string): Promise<Array<string>> {
        const nfDResponse = await this.getNFDRecordsOwnedByDiscordID(discordID);
        return Array.from(new Set(nfDResponse.flatMap(nfdRecord => nfdRecord.caAlgo || [])));
    }

    /**
     * Retrieves an array of full NFD records owned by a wallet.
     * @param {string} wallet - The wallet address of the records owner.
     * @returns {Promise<Array<NFDRecord>>} An array of full NFD records owned by the wallet.
     * @throws {Error} If the API request fails.
     */
    public async getNFDRecordsOwnedByWallet(wallet: string): Promise<Array<NFDRecord>> {
        return await this.rateLimitedRequest(async () => {
            const response = await this.apiFetch<Array<NFDRecord>>('nfd', {
                params: {
                    owner: wallet,
                    limit: 200,
                    view: 'full',
                },
            });
            return response.data;
        }).catch(error => {
            logger.error(`[x] ${error}`);
            return Promise.reject(error);
        });
    }
    /**
     * Returns an array of domain names owned by a wallet.
     *
     * @param {string} wallet - The wallet address.
     * @returns {Promise<string[]>} - An array of domain names owned by the wallet.
     * @throws {Error} - If an error occurs while fetching data from the API.
     */
    public async getWalletDomainNamesFromWallet(wallet: string): Promise<Array<string>> {
        // Fetches all NFD records owned by the wallet.
        const nfdResponse = await this.getNFDRecordsOwnedByWallet(wallet);

        // Filters the NFD records to include only those with a valid domain name,
        // and extracts the domain name from each record.
        return nfdResponse.filter(nfdRecord => nfdRecord.name).map(nfdRecord => nfdRecord.name);
    }
    /**
     * Checks whether a wallet is owned by a Discord ID.
     *
     * @param {string} discordID The Discord ID to validate ownership for.
     * @param {string} wallet The wallet to check for ownership.
     * @returns {Promise<boolean>} A Promise that resolves to true if the wallet is owned by the Discord ID, false otherwise.
     */
    public async checkWalletOwnershipFromDiscordID(
        discordID: string,
        wallet: string
    ): Promise<boolean> {
        const nfdResponse = await this.getNFDRecordsOwnedByWallet(wallet);
        const discordIds = nfdResponse
            .filter(nfdRecord => nfdRecord.properties?.verified?.discord)
            .map(nfdRecord => nfdRecord.properties?.verified?.discord);

        return discordIds.length === 0 || discordIds.includes(discordID);
    }
}
