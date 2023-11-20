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
import {
  formatMessage,
  InternalUserMessageFormats,
  removeInternalUserWalletMessageParser,
  WalletUserMessageFormats,
} from './internal-user.formatter.js';

@injectable()
@singleton()
export class InternalUserService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(Algorand) private algorand: Algorand,
  ) {}
  async getUserWallets(InternalUserIDs: InternalUserIDs): Promise<WalletAddress[]> {
    const discordUserId = InternalUserIDs.toString() as DiscordId;
    const userWithWallets = await this.userRepo.getUserByID(discordUserId);
    if (!userWithWallets || !userWithWallets.algoWallets) {
      return [];
    }
    return userWithWallets.algoWallets.map((wallet) => wallet.address);
  }
  async addWalletToUser(
    walletAddress: WalletAddress,
    internalUserId: InternalUserIDs,
  ): Promise<string> {
    try {
      const discordUserId = internalUserId.toString() as DiscordId;
      await this.userRepo.upsertWalletToUser(walletAddress, discordUserId);
      return formatMessage(WalletUserMessageFormats.WalletAdded, walletAddress, internalUserId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('E11000')) {
        return formatMessage(
          WalletUserMessageFormats.WalletAlreadyExists,
          walletAddress,
          internalUserId,
        );
      } else {
        logger.error(error);
        return formatMessage(
          WalletUserMessageFormats.ErrorAddingWallet,
          walletAddress,
          internalUserId,
        );
      }
    }
  }
  async removeWalletFromUser(
    walletAddress: WalletAddress,
    discordUserId: DiscordId,
  ): Promise<UpdateWriteOpResult> {
    return await this.userRepo.removeWalletFromUser(walletAddress, discordUserId);
  }

  async getInternalUser(internalUser: InternalUserIDs): Promise<DatabaseUser> {
    const internal = await this.userRepo.getUserByID(internalUser.toString() as DiscordId);
    if (!internal) {
      throw new Error(formatMessage(InternalUserMessageFormats.InternalUserNotFound, internalUser));
    }
    return internal;
  }
  async addInternalUserWallet(
    walletAddress: WalletAddress,
    internalUserId: InternalUserIDs,
  ): Promise<string> {
    const message = await this.addWalletToUser(walletAddress, internalUserId);
    if (message.includes('added') && InternalUserIDs.creator === internalUserId) {
      await this.creatorAssetSync();
    }
    return message;
  }

  async removeInternalUserWallet(
    walletAddress: WalletAddress,
    internalUserId: InternalUserIDs,
  ): Promise<string> {
    const { modifiedCount, matchedCount } = await this.removeWalletFromUser(
      walletAddress,
      internalUserId.toString() as DiscordId,
    );

    let deletedCount;
    if (internalUserId === InternalUserIDs.creator) {
      const result = await this.algoNFTAssetService.removeCreatorsAssets(walletAddress);
      deletedCount = result.deletedCount;
    }

    return removeInternalUserWalletMessageParser(
      walletAddress,
      internalUserId,
      modifiedCount,
      matchedCount,
      deletedCount,
    );
  }
  async creatorAssetSync(): Promise<void> {
    const creatorAddressArray = await this.getUserWallets(InternalUserIDs.creator);
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
