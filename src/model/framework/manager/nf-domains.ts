import type { NFDRecordsByWallet } from '../../types/nf-domains.js';
import { isValidAddress } from 'algosdk';
import { singleton } from 'tsyringe';

import logger from '../../../utils/functions/logger-factory.js';
import { AbstractRequestEngine } from '../engine/impl/abstract-request-engine.js';

@singleton()
export class NFDomainsManager extends AbstractRequestEngine {
    public constructor() {
        super('https://api.nf.domains/');
    }
    public async getNFDRecordsOwnedByWallet(
        algorandWalletAddr: string
    ): Promise<NFDRecordsByWallet> {
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
            logger.error(`[x] ${JSON.stringify(error)}`);
            throw error;
        });
    }
    public async getWalletDomainNamesFromWallet(algorandWalletAddr: string): Promise<string[]> {
        const nfdResponse = await this.getNFDRecordsOwnedByWallet(algorandWalletAddr);
        const responseByWallet = nfdResponse[algorandWalletAddr];
        if (
            !nfdResponse ||
            !this.isNFDWalletVerified(algorandWalletAddr, nfdResponse) ||
            !responseByWallet
        ) {
            return [];
        }

        return responseByWallet
            .filter(nfdRecord => nfdRecord.name)
            .map(nfdRecord => nfdRecord.name);
    }
    public async isWalletOwnedByOtherDiscordID(
        discordID: string,
        algorandWalletAddr: string
    ): Promise<boolean> {
        const nfdResponse = await this.getNFDRecordsOwnedByWallet(algorandWalletAddr);
        const responseByWallet = nfdResponse[algorandWalletAddr];

        if (
            !nfdResponse ||
            !this.isNFDWalletVerified(algorandWalletAddr, nfdResponse) ||
            !responseByWallet
        ) {
            return false;
        }

        const discordIds = responseByWallet
            .filter(nfdRecord => nfdRecord.properties?.verified?.discord)
            .map(nfdRecord => nfdRecord?.properties?.verified?.discord);
        if (discordIds.length === 0) {
            return false;
        }
        return !discordIds.includes(discordID);
    }
    public isNFDWalletVerified(
        algorandWalletAddr: string,
        NFDRecords?: NFDRecordsByWallet
    ): boolean {
        if (!NFDRecords) {
            return false;
        }

        const responseByWallet = NFDRecords[algorandWalletAddr];

        return (
            responseByWallet?.some(
                nfdRecord =>
                    nfdRecord.caAlgo?.includes(algorandWalletAddr) ||
                    nfdRecord.owner === algorandWalletAddr ||
                    nfdRecord.depositAccount === algorandWalletAddr ||
                    !nfdRecord.unverifiedCaAlgo?.includes(algorandWalletAddr)
            ) ?? false
        );
    }
}
