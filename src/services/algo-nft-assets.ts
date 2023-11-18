import { inject, injectable, singleton } from 'tsyringe';

import { AlgoNFTAssetRepository } from '../database/algo-nft-asset/algo-nft-asset.repo.js';
import { AlgoNFTAsset, IAlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { DiscordId, WalletAddress } from '../types/core.js';
import { IGameStats } from '../types/daruma-training.js';
import { getAssetUrl } from '../utils/functions/dt-images.js';
import logger from '../utils/functions/logger-factory.js';

import { Algorand } from './algorand.js';
import { UserService } from './user.js';

@singleton()
@injectable()
export class AlgoNFTAssetService {
  constructor(
    @inject(AlgoNFTAssetRepository) private algoNFTRepo: AlgoNFTAssetRepository,
    @inject(Algorand) private algorand: Algorand,
    @inject(UserService) private userService: UserService,
  ) {}
  async getAssetById(assetId: number): Promise<AlgoNFTAsset | null> {
    return await this.algoNFTRepo.getAssetById(assetId);
  }
  async getAllAssets(): Promise<AlgoNFTAsset[]> {
    return await this.algoNFTRepo.getAllAssets();
  }
  async getAllAssetIndexesWithoutArc69(): Promise<number[]> {
    const assets = await this.algoNFTRepo.getAssetsWithoutArc69();
    return assets.map((asset) => asset.id);
  }
  async getAllAssetsByOwner(discordUserId: DiscordId): Promise<AlgoNFTAsset[]> {
    const ownerWallets = await this.userService.getUserWallets(discordUserId);
    return await this.algoNFTRepo.getAssetsByWallets(ownerWallets);
  }
  async getOwnerWalletFromAssetIndex(assetIndex: number): Promise<WalletAddress> {
    const asset = await this.algoNFTRepo.getAssetById(assetIndex);
    const ownerWallet = asset?.wallet;
    if (!ownerWallet) {
      throw new Error('Owner wallet not found');
    }
    return ownerWallet;
  }

  async addNFTAsset(asset: AlgoNFTAsset): Promise<AlgoNFTAsset> {
    return await this.algoNFTRepo.createAsset(asset);
  }
  async addOrUpdateManyAssets(assets: AlgoNFTAsset[] | IAlgoNFTAsset[]): Promise<void> {
    await this.algoNFTRepo.addOrUpdateManyAssets(assets);
  }
  async removeCreatorsAssets(walletAddress: WalletAddress): Promise<void> {
    await this.algoNFTRepo.removeAssetsByCreator(walletAddress);
  }
  async assetEndGameUpdate(
    asset: number,
    cooldown: number,
    dojoTraining: IGameStats,
  ): Promise<AlgoNFTAsset | null> {
    return await this.algoNFTRepo.updateAssetDojoStats(
      asset,
      cooldown,
      dojoTraining.wins,
      dojoTraining.losses,
      dojoTraining.zen,
    );
  }
  async zeroOutAssetCooldown(asset: number): Promise<void> {
    await this.algoNFTRepo.updateAssetDojoStats(asset, 0);
  }

  async clearAssetCoolDownsForAllUsers(): Promise<void> {
    await this.algoNFTRepo.clearAllAssetsCoolDowns();
  }

  async clearAssetCoolDownsForUser(discordId: DiscordId): Promise<void> {
    // get wallets for user
    const userWallets = await this.userService.getUserWallets(discordId);
    // clear cool downs for each wallet
    await this.algoNFTRepo.clearAssetsCoolDownsByWallets(userWallets);
  }
  async getSampleOfAssetsByUser(
    discordId: DiscordId,
    numberOfAssets: number,
  ): Promise<AlgoNFTAsset[] | []> {
    const userWallets = await this.userService.getUserWallets(discordId);

    // Get a random sample of assets from all wallets
    return await this.algoNFTRepo.getRandomAssetsSampleByWallets(userWallets, numberOfAssets);
  }

  async randomAssetCoolDownReset(
    discordId: DiscordId,
    numberOfAssets: number,
  ): Promise<AlgoNFTAsset[] | []> {
    const assetsToReset = await this.getSampleOfAssetsByUser(discordId, numberOfAssets);
    // Reset the cooldowns
    const assetIdsToReset = assetsToReset.map((asset) => asset._id);
    await this.algoNFTRepo.clearAssetsCoolDownsByIds(assetIdsToReset);

    // Return the assets that were reset
    return assetsToReset;
  }

  async updateOwnerWalletsOnCreatorAssets(): Promise<void> {
    const allAssets = await this.getAllAssets();
    const updates = [];
    for (const asset of allAssets) {
      try {
        const assetIndex = asset._id;
        const owner = await this.algorand.lookupAssetBalances(assetIndex);

        if (owner[0] && asset.wallet !== owner[0].address) {
          asset.wallet = owner[0].address as WalletAddress;
          updates.push(asset);
        }
      } catch (error) {
        logger.error(`Error updating owner for asset ${asset._id}: ${error as string}`);
      }
    }

    if (updates.length > 0) {
      await this.algoNFTRepo.addOrUpdateManyAssets(updates);
    } else {
      logger.info('No asset owner updates required.');
    }
  }
  async updateBulkArc69(): Promise<void> {
    const assetsWithUpdates = await this.algorand.getBulkAssetArc69Metadata(
      await this.getAllAssetIndexesWithoutArc69(),
    );
    await this.algoNFTRepo.updateArc69ForMultipleAssets(assetsWithUpdates);
  }

  async getRandomImageURLByWallet(walletAddress: WalletAddress): Promise<string> {
    const randomAssets = await this.algoNFTRepo.getRandomAssetsSampleByWallets([walletAddress], 1);
    const firstAsset = randomAssets[0];
    return await getAssetUrl(firstAsset);
  }
}
