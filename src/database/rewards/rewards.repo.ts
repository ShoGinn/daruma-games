import { singleton } from 'tsyringe';

import { DiscordId, WalletAddress } from '../../types/core.js';

import { rewardsModel } from './rewards.js';
import { Reward } from './rewards.schema.js';

@singleton()
export class RewardsRepository {
  async updateTemporaryTokens(
    discordUserId: DiscordId,
    walletAddress: WalletAddress,
    asaId: number,
    amount: number,
  ): Promise<number | undefined> {
    const reward = await rewardsModel
      .findOneAndUpdate(
        { discordUserId, walletAddress, asaId },
        { $inc: { temporaryTokens: amount } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return reward?.temporaryTokens;
  }

  async getAllRewardTokensByWallet(walletAddress: WalletAddress): Promise<Reward[] | []> {
    return await rewardsModel.find({ walletAddress }).exec();
  }
  async getRewardsByDiscordUserAndAsa(discordUserId: DiscordId, asaId: number): Promise<Reward[]> {
    return await rewardsModel.find({ discordUserId, asaId }).exec();
  }
  async getWalletsWithTemporaryTokensAboveThreshold(
    asaId: number,
    claimThreshold: number = 0,
    discordUserId?: DiscordId,
  ): Promise<Reward[]> {
    if (!discordUserId) {
      return await rewardsModel.find({ asaId, temporaryTokens: { $gt: claimThreshold } }).exec();
    }
    return await rewardsModel
      .find({ discordUserId, asaId, temporaryTokens: { $gt: claimThreshold } })
      .exec();
  }
}
