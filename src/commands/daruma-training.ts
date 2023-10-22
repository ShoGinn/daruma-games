import { Loaded } from '@mikro-orm/core';
import { ButtonInteraction, GuildChannel, TextBasedChannel } from 'discord.js';
import { ButtonComponent, Client, Discord } from 'discordx';
import { injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannel } from '../entities/dt-channel.entity.js';
import { WaitingRoomInteractionIds } from '../enums/daruma-training.js';
import { withCustomDiscordApiErrorLogger } from '../model/framework/decorators/discord-error-handler.js';
import { IdtGames } from '../model/types/daruma-training.js';
import { DarumaTrainingGameRepository } from '../repositories/dt-game-repository.js';
import { Game } from '../utils/classes/dt-game.js';
import {
  paginatedDarumaEmbed,
  quickJoinDaruma,
  registerPlayer,
  withdrawPlayer,
} from '../utils/functions/dt-embeds.js';
import { buildGameType } from '../utils/functions/dt-utils.js';
import logger from '../utils/functions/logger-factory.js';
import { getDeveloperMentions } from '../utils/utils.js';

@Discord()
@injectable()
@singleton()
export class DarumaTrainingManager {
  public allGames: IdtGames;
  public DarumaTrainingGameRepository: DarumaTrainingGameRepository;
  constructor(private client: Client) {
    this.DarumaTrainingGameRepository = new DarumaTrainingGameRepository();
    this.allGames = new Map();
  }

  async startGamesForAllChannels(
    channelSettings: Array<Loaded<DarumaTrainingChannel, never>>,
  ): Promise<void> {
    const gamesCollections = await Promise.all(
      channelSettings.map(async (channelSetting) => {
        const gameSettings = buildGameType(channelSetting);
        const game = new Game(gameSettings);
        await game.initialize(this.client);
        return { game, gameSettings };
      }),
    );

    for (const gamesCollection of gamesCollections) {
      if (!gamesCollection) {
        continue;
      }
      this.allGames.set(gamesCollection.gameSettings.channelId, gamesCollection.game);
    }
  }

  async startWaitingRooms(): Promise<void> {
    const gameChannels = await this.DarumaTrainingGameRepository.getAllChannelsInDB(
      this.client.guilds.cache,
    );
    await this.startGamesForAllChannels(gameChannels);
  }

  async startWaitingRoomForChannel(channel: TextBasedChannel | GuildChannel): Promise<boolean> {
    try {
      const gameChannel = await this.DarumaTrainingGameRepository.getChannelFromDB(channel);
      if (!gameChannel) {
        return false;
      }
      await this.startGamesForAllChannels([gameChannel]);
      return true;
    } catch (error) {
      logger.error('Could not start the waiting room because:', error);
      return false;
    }
  }

  async stopWaitingRoomsOnceGamesEnd(): Promise<void> {
    await Promise.allSettled(
      Object.values(this.allGames).map((game) =>
        game.waitingRoomManager.stopWaitingRoomOnceGameEnds(),
      ),
    );
  }

  async respondWhenGameDoesNotExist(interaction: ButtonInteraction): Promise<boolean> {
    const game = this.allGames.get(interaction.channelId);
    if (!game) {
      const channel = interaction.channel?.toString() ?? 'this channel';
      const response = `The game in ${channel} does not exist. Please contact ${getDeveloperMentions()} to resolve this issue.`;
      await interaction.reply(response);
      return true;
    }
    return false;
  }

  @ButtonComponent({ id: WaitingRoomInteractionIds.registerPlayer })
  @withCustomDiscordApiErrorLogger
  async registerPlayer(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await paginatedDarumaEmbed(interaction, this.allGames);
  }

  @ButtonComponent({ id: WaitingRoomInteractionIds.quickJoin })
  @withCustomDiscordApiErrorLogger
  async quickJoin(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await quickJoinDaruma(interaction, this.allGames);
  }

  @ButtonComponent({ id: /((daruma-select_)\S*)\b/gm })
  @withCustomDiscordApiErrorLogger
  async selectAsset(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await registerPlayer(interaction, this.allGames);
  }

  @ButtonComponent({ id: WaitingRoomInteractionIds.withdrawPlayer })
  async withdrawPlayer(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await withdrawPlayer(interaction, this.allGames);
  }
}
