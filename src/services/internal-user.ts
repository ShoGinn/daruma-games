import { UpdateWriteOpResult } from 'mongoose';
import { inject, injectable, singleton } from 'tsyringe';

import { IAlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { UserRepository } from '../database/user/user.repo.js';
import { DatabaseUser } from '../database/user/user.schema.js';
import { InternalUserIDs } from '../enums/daruma-training.js';
import { Asset } from '../types/algorand.js';
import { DiscordId, WalletAddress } from '../types/core.js';
import logger from '../utils/functions/logger-factory.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { Algorand } from './algorand.js';

@injectable()
@singleton()
export class InternalUserService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(Algorand) private algorand: Algorand,
  ) {}
  async getUserWallets(discordUserId: DiscordId): Promise<WalletAddress[]> {
    const userWithWallets = await this.userRepo.getUserByID(discordUserId);
    if (!userWithWallets || !userWithWallets.algoWallets) {
      return [];
    }
    return userWithWallets.algoWallets.map((wallet) => wallet.address);
  }

  async getCreators(): Promise<DatabaseUser> {
    return await this.getInternalUser(InternalUserIDs.creator);
  }
  async getReservedUsers(): Promise<DatabaseUser> {
    return await this.getInternalUser(InternalUserIDs.reserved);
  }

  async getCreatorWallets(): Promise<WalletAddress[]> {
    return await this.getUserWallets(InternalUserIDs.creator.toString() as DiscordId);
  }
  async getReservedWallets(): Promise<WalletAddress[]> {
    return await this.getUserWallets(InternalUserIDs.reserved.toString() as DiscordId);
  }

  async getInternalUser(internalUser: InternalUserIDs): Promise<DatabaseUser> {
    const internal = await this.userRepo.getUserByID(internalUser.toString() as DiscordId);
    if (!internal) {
      throw new Error(`Internal user not found: ${internalUser}`);
    }
    return internal;
  }

  async addCreatorWallet(walletAddress: WalletAddress): Promise<string> {
    return await this.addInternalUserWallet(walletAddress, InternalUserIDs.creator, true);
  }

  async addReservedWallet(walletAddress: WalletAddress): Promise<string> {
    return await this.addInternalUserWallet(walletAddress, InternalUserIDs.reserved);
  }
  async removeCreatorWallet(walletAddress: WalletAddress): Promise<void> {
    return await this.removeInternalUserWallet(walletAddress, InternalUserIDs.creator);
  }

  async removeReservedWallet(walletAddress: WalletAddress): Promise<void> {
    return await this.removeInternalUserWallet(walletAddress, InternalUserIDs.reserved);
  }

  async addWalletToUser(walletAddress: WalletAddress, discordUserId: DiscordId): Promise<string> {
    let message = 'Wallet added to user';
    try {
      await this.userRepo.upsertWalletToUser(walletAddress, discordUserId);
    } catch (error) {
      logger.error('Error adding wallet to user', { walletAddress, discordUserId });
      if (error instanceof Error) {
        logger.error(error.message);
        message = error.message.includes('E11000')
          ? 'Wallet already exists'
          : 'Error adding wallet to user';
      }
    }
    return message;
  }
  async removeWalletFromUser(
    walletAddress: WalletAddress,
    discordUserId: DiscordId,
  ): Promise<UpdateWriteOpResult> {
    return await this.userRepo.removeWalletFromUser(walletAddress, discordUserId);
  }
  async addInternalUserWallet(
    walletAddress: WalletAddress,
    internalUserId: InternalUserIDs,
    syncCreatorAssets: boolean = false,
  ): Promise<string> {
    const internalUser = await this.addWalletToUser(
      walletAddress,
      internalUserId.toString() as DiscordId,
    );
    if (internalUser.includes('added') && syncCreatorAssets) {
      await this.creatorAssetSync();
    }
    return internalUser;
  }

  async removeInternalUserWallet(
    walletAddress: WalletAddress,
    internalUserId: InternalUserIDs,
  ): Promise<void> {
    await this.removeWalletFromUser(walletAddress, internalUserId.toString() as DiscordId);
    if (internalUserId === InternalUserIDs.creator) {
      await this.algoNFTAssetService.removeCreatorsAssets(walletAddress);
    }
  }

  async creatorAssetSync(): Promise<void> {
    const creatorAddressArray = await this.getCreatorWallets();
    for (const address of creatorAddressArray) {
      const creatorAssets = await this.algorand.getCreatedAssets(address);
      await this.addCreatorAssets(address, creatorAssets);
    }
    await this.algoNFTAssetService.updateBulkArc69();
    await this.algoNFTAssetService.updateOwnerWalletsOnCreatorAssets();
  }
  async addCreatorAssets<T extends Asset>(
    walletAddress: WalletAddress,
    creatorAssets: T[],
  ): Promise<void> {
    const existingAssets = await this.algoNFTAssetService.getAllAssets();
    // Filter out assets that already exist
    const filteredAssets = creatorAssets.filter(
      (asset) => !existingAssets.some((existingAsset) => existingAsset._id === asset.index),
    );
    const newAssets = filteredAssets.map((nonExistingAsset) => {
      const assetId = nonExistingAsset?.index;
      const { url, name, 'unit-name': unitName } = nonExistingAsset.params;
      return {
        _id: assetId,
        creator: walletAddress,
        name: name ?? ' ',
        unitName: unitName ?? ' ',
        url: url ?? ' ',
      } as IAlgoNFTAsset;
    });
    await this.algoNFTAssetService.addOrUpdateManyAssets(newAssets);
  }
}
