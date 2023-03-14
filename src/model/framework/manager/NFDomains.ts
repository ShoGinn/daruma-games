import type { NFDRecordsByWallet } from '../../types/NFDomain.js';
import { isValidAddress } from 'algosdk';
import { singleton } from 'tsyringe';

import logger from '../../../utils/functions/LoggerFactory.js';
import { AbstractRequestEngine } from '../engine/impl/AbstractRequestEngine.js';

@singleton()
export class NFDomainsManager extends AbstractRequestEngine {
    public constructor() {
        super('https://api.nf.domains/');
    }
    public async getNFDRecordsOwnedByWallet(
        algorandWalletAddr: string
    ): Promise<NFDRecordsByWallet | void> {
        if (isValidAddress(algorandWalletAddr) === false) {
            throw new Error(`Invalid Algorand wallet address: ${algorandWalletAddr}`);
        }
        return await this.rateLimitedRequest(async () => {
            const response = await this.apiFetch<NFDRecordsByWallet>('nfd/v2/address', {
                params: {
                    address: algorandWalletAddr,
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
    public async getWalletDomainNamesFromWallet(algorandWalletAddr: string): Promise<string[]> {
        // Fetches all NFD records owned by the wallet.
        const nfdResponse = await this.getNFDRecordsOwnedByWallet(algorandWalletAddr);
        if (!nfdResponse) return [];
        if (!this.isNFDWalletIsVerified(algorandWalletAddr, nfdResponse)) {
            return [];
        }
        const responseByWallet = nfdResponse[algorandWalletAddr];
        // Filters the NFD records to include only those with a valid domain name,
        // and extracts the domain name from each record.
        return responseByWallet
            .filter(nfdRecord => nfdRecord.name)
            .map(nfdRecord => nfdRecord.name);
    }
    public async isWalletOwnedByOtherDiscordID(
        discordID: string,
        algorandWalletAddr: string
    ): Promise<boolean> {
        const nfdResponse = await this.getNFDRecordsOwnedByWallet(algorandWalletAddr);
        if (!nfdResponse) return false;
        if (!this.isNFDWalletIsVerified(algorandWalletAddr, nfdResponse)) {
            return false;
        }
        const responseByWallet = nfdResponse[algorandWalletAddr];
        const discordIds = responseByWallet
            .filter(nfdRecord => nfdRecord.properties?.verified?.discord)
            .map(nfdRecord => nfdRecord.properties?.verified?.discord);
        if (discordIds.length === 0 || discordIds.includes(discordID)) {
            return false;
        }
        return true;
    }
    public isNFDWalletIsVerified(
        algorandWalletAddr: string,
        NFDRecords: NFDRecordsByWallet | void
    ): boolean {
        if (!NFDRecords) return false;
        const responseByWallet = NFDRecords[algorandWalletAddr];
        return responseByWallet.some(nfdRecord => {
            if (
                nfdRecord.caAlgo?.includes(algorandWalletAddr) ||
                nfdRecord.owner === algorandWalletAddr ||
                nfdRecord.depositAccount === algorandWalletAddr
            ) {
                return true;
            }
            return !nfdRecord.unverifiedCaAlgo?.includes(algorandWalletAddr);
        });
    }
}
