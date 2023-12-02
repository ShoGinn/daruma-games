import { HydratedDocument, Schema } from 'mongoose';

import { DiscordId, WalletAddress } from '../../types/core.js';

export interface IReward {
  discordUserId: DiscordId;
  walletAddress: WalletAddress;
  asaId: number;
  temporaryTokens: number;
}

export const rewardSchema = new Schema<IReward>({
  discordUserId: { type: String, required: true },
  walletAddress: { type: String, required: true },
  asaId: { type: Number, required: true },
  temporaryTokens: { type: Number, required: true, default: 0 },
});

export type Reward = HydratedDocument<IReward>;
