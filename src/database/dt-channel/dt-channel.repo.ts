import { singleton } from 'tsyringe';

import { GameTypes } from '../../enums/daruma-training.js';

import { darumaTrainingChannelModel } from './dt-channel.js';
import { DarumaTrainingChannel } from './dt-channel.schema.js';

@singleton()
export class DarumaTrainingChannelRepository {
  async getAllChannelsByGuildIds(guildIds: string[]): Promise<DarumaTrainingChannel[]> {
    return await darumaTrainingChannelModel.find({ guild: { $in: guildIds } });
  }
  async getChannelById(channelId: string): Promise<DarumaTrainingChannel | null> {
    return await darumaTrainingChannelModel.findById(channelId).exec();
  }

  async upsertChannel(
    channelId: string,
    gameType: GameTypes,
    guildId: string,
  ): Promise<DarumaTrainingChannel> {
    return await darumaTrainingChannelModel.findOneAndUpdate(
      { _id: channelId },
      { $set: { gameType, guild: guildId } },
      { new: true, upsert: true },
    );
  }

  async deleteChannelById(channelId: string): Promise<boolean> {
    const result = await darumaTrainingChannelModel.deleteOne({ _id: channelId }).exec();
    return result.deletedCount > 0;
  }
}
