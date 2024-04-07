import { isValidAddress } from 'algosdk';
import { singleton } from 'tsyringe';

import { AbstractRequestEngine } from '../engine/impl/abstract-request-engine.js';
import { paths } from '../types/api-generated/nfdomains.js';
import { DiscordId, WalletAddress } from '../types/core.js';
import logger from '../utils/functions/logger-factory.js';

export type NFDSuccessResponse =
  paths['/nfd/v2/address']['get']['responses']['200']['content']['application/json'];

@singleton()
export class NFDomainsManager extends AbstractRequestEngine {
  public constructor() {
    super('https://api.nf.domains/');
  }
  public async getNFDRecordsOwnedByWallet(
    algorandWalletAddr: WalletAddress,
  ): Promise<NFDSuccessResponse> {
    if (!isValidAddress(algorandWalletAddr)) {
      throw new Error(`Invalid Algorand wallet address: ${algorandWalletAddr}`);
    }
    try {
      const response = await this.apiFetch<NFDSuccessResponse>('nfd/v2/address', {
        params: {
          address: algorandWalletAddr,
          limit: 200,
          view: 'full',
        },
      });
      return response.data;
    } catch (error) {
      logger.error(`[x] ${JSON.stringify(error)}`);
      throw error;
    }
  }
  public async getWalletDomainNamesFromWallet(
    algorandWalletAddr: WalletAddress,
  ): Promise<string[]> {
    const nfdResponse = await this.getNFDRecordsOwnedByWallet(algorandWalletAddr);
    const responseByWallet = nfdResponse[algorandWalletAddr];
    if (!this.isNFDWalletVerified(algorandWalletAddr, nfdResponse) || !responseByWallet) {
      return [];
    }

    return responseByWallet
      .filter((nfdRecord) => nfdRecord.name)
      .map((nfdRecord) => nfdRecord.name);
  }
  public async isWalletOwnedByOtherDiscordID(
    discordId: DiscordId,
    algorandWalletAddr: WalletAddress,
  ): Promise<boolean> {
    const nfdResponse = await this.getNFDRecordsOwnedByWallet(algorandWalletAddr);
    const responseByWallet = nfdResponse[algorandWalletAddr];

    if (!this.isNFDWalletVerified(algorandWalletAddr, nfdResponse) || !responseByWallet) {
      return false;
    }

    const discordIds = responseByWallet
      .filter((nfdRecord) => nfdRecord.properties?.verified?.['discord'])
      .map((nfdRecord) => nfdRecord.properties?.verified?.['discord']);
    if (discordIds.length === 0) {
      return false;
    }
    return !discordIds.includes(discordId);
  }
  public isNFDWalletVerified(
    algorandWalletAddr: WalletAddress,
    NFDRecords?: NFDSuccessResponse,
  ): boolean {
    if (!NFDRecords) {
      return false;
    }

    const responseByWallet = NFDRecords[algorandWalletAddr];

    return (
      responseByWallet?.some(
        (nfdRecord) =>
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          nfdRecord.caAlgo?.includes(algorandWalletAddr) ||
          nfdRecord.owner === algorandWalletAddr ||
          nfdRecord.depositAccount === algorandWalletAddr ||
          !nfdRecord.unverifiedCaAlgo?.includes(algorandWalletAddr),
      ) ?? false
    );
  }
}
