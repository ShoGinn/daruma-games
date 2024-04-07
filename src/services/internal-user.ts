import { UpdateWriteOpResult } from 'mongoose';
import { inject, injectable, singleton } from 'tsyringe';

import { IAlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { isDuplicate } from '../database/mongoose.errorprocessor.js';
import { UserRepository } from '../database/user/user.repo.js';
import { DatabaseUser } from '../database/user/user.schema.js';
import { Asset } from '../types/algorand.js';
import { DiscordId, WalletAddress } from '../types/core.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { Algorand } from './algorand.js';
import {
  InternalUserNotFound,
  internalUserWalletActionsTemplate,
  removeInternalUserWalletMessageParser,
} from './internal-user.formatter.js';

@injectable()
@singleton()
export class InternalUserService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(Algorand) private algorand: Algorand,
  ) {}
  async getUserWallets(internalUser: InternalUser): Promise<WalletAddress[]> {
    const userWithWallets = await this.userRepo.getUserByID(internalUser.discordId);
    if (!userWithWallets || !userWithWallets.algoWallets) {
      return [];
    }
    return userWithWallets.algoWallets.map((wallet) => wallet.address);
  }
  async addWalletToUser(walletAddress: WalletAddress, internalUser: InternalUser): Promise<string> {
    try {
      await this.userRepo.upsertWalletToUser(walletAddress, internalUser.discordId);
      return internalUserWalletActionsTemplate.WalletAdded({ walletAddress, internalUser });
    } catch (error) {
      return isDuplicate(error)
        ? internalUserWalletActionsTemplate.WalletAlreadyExists({
            walletAddress,
            internalUser,
          })
        : internalUserWalletActionsTemplate.ErrorAddingWallet({ walletAddress, internalUser });
    }
  }
  async removeWalletFromUser(
    walletAddress: WalletAddress,
    discordUserId: DiscordId,
  ): Promise<UpdateWriteOpResult> {
    return await this.userRepo.removeWalletFromUser(walletAddress, discordUserId);
  }

  async getInternalUser(internalUser: InternalUser): Promise<DatabaseUser> {
    const internal = await this.userRepo.getUserByID(internalUser.discordId);
    if (!internal) {
      throw new Error(InternalUserNotFound({ internalUser }));
    }
    return internal;
  }
  async addInternalUserWallet(
    walletAddress: WalletAddress,
    internalUser: InternalUser,
  ): Promise<string> {
    const message = await this.addWalletToUser(walletAddress, internalUser);
    if (message.includes('added') && internalUser.isCreator) {
      await this.creatorAssetSync();
    }
    return message;
  }

  async removeInternalUserWallet(
    walletAddress: WalletAddress,
    internalUser: InternalUser,
  ): Promise<string> {
    const { modifiedCount, matchedCount } = await this.removeWalletFromUser(
      walletAddress,
      internalUser.discordId,
    );

    let deletedCount;
    if (internalUser.isCreator) {
      const result = await this.algoNFTAssetService.removeCreatorsAssets(walletAddress);
      deletedCount = result.deletedCount;
    }

    return removeInternalUserWalletMessageParser(
      walletAddress,
      internalUser,
      modifiedCount,
      matchedCount,
      deletedCount,
    );
  }
  async creatorAssetSync(): Promise<void> {
    const creatorAddressArray = await this.getUserWallets(internalUserCreator);
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
      const assetId = nonExistingAsset.index;
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

export class InternalUser {
  constructor(
    public id: number,
    public username: string,
  ) {}

  get discordId(): DiscordId {
    return this.id.toString() as DiscordId;
  }
  get isCreator(): boolean {
    return this.username === 'Creator';
  }
  get isReserved(): boolean {
    return this.username === 'Reserved';
  }
}

export const internalUserCreator = new InternalUser(1, 'Creator');
export const internalUserReserved = new InternalUser(5, 'Reserved');
