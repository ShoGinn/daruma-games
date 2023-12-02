import { model } from 'mongoose';

import { IReward, rewardSchema } from './rewards.schema.js';

export const rewardsModel = model<IReward>('Reward', rewardSchema);
