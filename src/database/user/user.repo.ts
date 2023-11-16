import { UpdateWriteOpResult } from 'mongoose';
import { singleton } from 'tsyringe';

import { DiscordId, WalletAddress } from '../../types/core.js';

import { userModel } from './user.js';
import { DatabaseUser } from './user.schema.js';

@singleton()
export class UserRepository {
  async addUser(discordUserId: DiscordId): Promise<void> {
    await userModel.create({ _id: discordUserId });
  }
  async getUserByID(discordUserId: DiscordId): Promise<DatabaseUser | null> {
    return await userModel.findById(discordUserId).exec();
  }
  async getUserByWallet(walletAddress: WalletAddress): Promise<DatabaseUser | null> {
    return await userModel.findOne({ 'algoWallets.address': walletAddress }).exec();
  }
  async getAllUsers(): Promise<DatabaseUser[]> {
    return await userModel.find({ _id: { $regex: /^.{10,}$/ } }).exec();
  }
  async upsertWalletToUser(
    walletAddress: WalletAddress,
    discordUserId: DiscordId,
  ): Promise<DatabaseUser | null> {
    return await userModel
      .findOneAndUpdate(
        { _id: discordUserId, 'algoWallets.address': { $ne: walletAddress } },
        { $push: { algoWallets: { address: walletAddress } } },
        { upsert: true, new: true },
      )
      .exec();
  }
  async removeWalletFromUser(
    walletAddress: WalletAddress,
    discordUserId: DiscordId,
  ): Promise<UpdateWriteOpResult> {
    return await userModel
      .updateOne({ _id: discordUserId }, { $pull: { algoWallets: { address: walletAddress } } })
      .exec();
  }

  async updateUserArtifacts(
    discordUserId: DiscordId,
    quantity: number,
  ): Promise<DatabaseUser | null> {
    return await userModel.findOneAndUpdate(
      { _id: discordUserId, artifactToken: { $gte: Math.abs(quantity) } },
      { $inc: { artifactToken: quantity } },
      { new: true },
    );
  }
}
