import { Collection, Guild } from 'discord.js';

import { inject, injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannelRepository } from '../database/dt-channel/dt-channel.repo.js';
import { DarumaTrainingChannel } from '../database/dt-channel/dt-channel.schema.js';
import { GameTypes } from '../enums/daruma-training.js';

@singleton()
@injectable()
export class DarumaTrainingChannelService {
  constructor(
    @inject(DarumaTrainingChannelRepository) private dtChannelRepo: DarumaTrainingChannelRepository,
  ) {}
  async getAllChannelsByGuildIds(
    guilds: Collection<string, Guild>,
  ): Promise<DarumaTrainingChannel[]> {
    const guildIds = [...guilds.keys()];
    return await this.dtChannelRepo.getAllChannelsByGuildIds(guildIds);
  }
  async getChannelById(channelId: string): Promise<DarumaTrainingChannel | null> {
    return await this.dtChannelRepo.getChannelById(channelId);
  }

  async upsertChannel(
    channelId: string,
    gameType: GameTypes,
    guildId: string,
  ): Promise<DarumaTrainingChannel> {
    return await this.dtChannelRepo.upsertChannel(channelId, gameType, guildId);
  }

  async deleteChannelById(channelId: string): Promise<boolean> {
    return await this.dtChannelRepo.deleteChannelById(channelId);
  }
}
