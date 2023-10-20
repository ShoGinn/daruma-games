import { Loaded } from '@mikro-orm/core';
import { Collection, Guild, GuildChannel, TextBasedChannel } from 'discord.js';

import { AbstractDatabaseRepository } from './abstract-database-repository.js';
import { AlgoNFTAsset } from '../entities/algo-nft-asset.entity.js';
import { DarumaTrainingChannel } from '../entities/dt-channel.entity.js';
import { DtEncounters } from '../entities/dt-encounters.entity.js';
import { User } from '../entities/user.entity.js';
import { InternalUserIDs } from '../enums/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';
import { Player } from '../utils/classes/dt-player.js';

export class DarumaTrainingGameRepository extends AbstractDatabaseRepository {
  public async getNPCPlayer(npcID: number): Promise<Player> {
    const em = this.orm.em.fork();
    const [botCreator, asset] = await Promise.all([
      em.getRepository(User).findOne({ id: InternalUserIDs.botCreator.toString() }),
      em.getRepository(AlgoNFTAsset).findOne({ id: npcID }),
    ]);
    if (!botCreator || !asset) {
      throw new Error(`Could not find bot creator or asset`);
    }
    return new Player(botCreator, asset);
  }
  public async createEncounter(game: Game): Promise<number> {
    const em = this.orm.em.fork();
    const encounter = await em.getRepository(DtEncounters).createEncounter(game);
    return encounter.id;
  }
  public async updateChannelMessageID(
    channelId: string,
    messageId: string,
  ): Promise<DarumaTrainingChannel> {
    const em = this.orm.em.fork();
    return await em.getRepository(DarumaTrainingChannel).updateMessageId(channelId, messageId);
  }
  public async getChannelFromDB(
    channel: TextBasedChannel | GuildChannel,
  ): Promise<Loaded<DarumaTrainingChannel, never>> {
    const em = this.orm.em.fork();
    return await em.getRepository(DarumaTrainingChannel).getChannel(channel);
  }
  public async removeChannelFromDB(channelId: string): Promise<boolean> {
    const em = this.orm.em.fork();
    const channel = await em.getRepository(DarumaTrainingChannel).findOne({ id: channelId });
    if (!channel) {
      return false;
    }
    await em.removeAndFlush(channel);
    return true;
  }
  public async getAllChannelsInDB(
    guilds: Collection<string, Guild>,
  ): Promise<Array<Loaded<DarumaTrainingChannel, never>>> {
    const em = this.orm.em.fork();
    const channels = await Promise.all(
      [...guilds.values()].map((guild) =>
        em.getRepository(DarumaTrainingChannel).getAllChannelsInGuild(guild.id),
      ),
    );
    return channels.flat();
  }
}
