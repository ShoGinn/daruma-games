import { UpdateWriteOpResult } from 'mongoose';
import { inject, injectable, singleton } from 'tsyringe';

import { processMongoError } from '../database/mongoose.errorprocessor.js';
import { UserRepository } from '../database/user/user.repo.js';
import { DatabaseUser } from '../database/user/user.schema.js';
import { GlobalEmitter } from '../emitters/global-emitter.js';
import { NFDomainsManager } from '../manager/nf-domains.js';
import { DiscordId, WalletAddress } from '../types/core.js';

import { userWalletActionsTemplate, userWalletOwnedTemplate } from './user.formatter.js';

@injectable()
@singleton()
export class UserService {
  constructor(
    @inject(UserRepository) private userRepo: UserRepository,
    @inject(NFDomainsManager) private nfDomainsMgr: NFDomainsManager,
    @inject(GlobalEmitter) private globalEmitter: GlobalEmitter,
  ) {}
  async getUserWallets(discordUserId: DiscordId): Promise<WalletAddress[]> {
    const userWithWallets = await this.userRepo.getUserByID(discordUserId);
    if (!userWithWallets || !userWithWallets.algoWallets) {
      return [];
    }
    return userWithWallets.algoWallets.map((wallet) => wallet.address);
  }
  async addWalletToUser(walletAddress: WalletAddress, discordUserId: DiscordId): Promise<string> {
    try {
      await this.walletOwnedByAnotherUser(discordUserId, walletAddress);
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      throw error; // re-throw the error if it's not an instance of Error
    }

    try {
      await this.userRepo.upsertWalletToUser(walletAddress, discordUserId);
      this.globalEmitter.emitLoadTemporaryTokens(walletAddress, discordUserId);
      return userWalletActionsTemplate.WalletAdded({ walletAddress, discordUserId });
    } catch (error) {
      const processedError = processMongoError(error);
      return processedError.code === 11_000
        ? userWalletActionsTemplate.WalletAlreadyExists({ walletAddress, discordUserId })
        : userWalletActionsTemplate.ErrorAddingWallet({ walletAddress, discordUserId });
    }
  }
  async addUser(discordUserId: DiscordId): Promise<void> {
    await this.userRepo.addUser(discordUserId);
  }
  async getUserByID(discordUserId: DiscordId): Promise<DatabaseUser> {
    let databaseUser = await this.userRepo.getUserByID(discordUserId);
    if (!databaseUser) {
      await this.addUser(discordUserId);
      databaseUser = await this.userRepo.getUserByID(discordUserId);
    }
    if (!databaseUser) {
      throw new Error(`User not found: ${discordUserId}`);
    }
    return databaseUser;
  }
  async getUserByWallet(walletAddress: WalletAddress): Promise<DatabaseUser> {
    const databaseUser = await this.userRepo.getUserByWallet(walletAddress);
    if (!databaseUser) {
      throw new Error(`Wallet not found: ${walletAddress}`);
    }
    return databaseUser;
  }
  async getAllUsers(): Promise<DatabaseUser[]> {
    return await this.userRepo.getAllUsers();
  }

  async removeWalletFromUser(
    walletAddress: WalletAddress,
    discordUserId: DiscordId,
  ): Promise<UpdateWriteOpResult> {
    return await this.userRepo.removeWalletFromUser(walletAddress, discordUserId);
  }
  async isWalletOwnedByOtherDiscordID(
    discordUserId: DiscordId,
    walletAddress: WalletAddress,
  ): Promise<boolean> {
    return await this.nfDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress);
  }

  async updateUserArtifacts(discordUserId: DiscordId, quantity: number): Promise<string> {
    const databaseUser = await this.userRepo.updateUserArtifacts(discordUserId, quantity);
    if (!databaseUser) {
      throw new Error(
        `Not enough artifacts to update user: ${discordUserId} with quantity: ${quantity}`,
      );
    }
    return databaseUser.artifactToken.toLocaleString();
  }

  async walletOwnedByAnotherUser(
    discordUserId: DiscordId,
    walletAddress: WalletAddress,
  ): Promise<void> {
    let walletOwner: DatabaseUser | undefined = undefined;
    // Check if wallet is valid on NFDomain
    if (await this.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress)) {
      throw new Error(
        userWalletOwnedTemplate.WalletFoundOnNFDomains({ walletAddress, discordUserId }),
      );
    }
    try {
      // Check if wallet is already owned by another user
      walletOwner = await this.getUserByWallet(walletAddress);
    } catch {
      // Wallet is not owned by another user
    }
    if (walletOwner && walletOwner._id !== discordUserId) {
      throw new Error(
        userWalletOwnedTemplate.WalletOwnedByAnotherUser({ walletAddress, discordUserId }),
      );
    }
  }
}
