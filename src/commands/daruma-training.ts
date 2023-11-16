import { ButtonInteraction, GuildChannel, TextBasedChannel, TextChannel } from 'discord.js';

import { ButtonComponent, Client, Discord } from 'discordx';

import { container, inject, injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannel } from '../database/dt-channel/dt-channel.schema.js';
import { withCustomDiscordApiErrorLogger } from '../decorators/discord-error-handler.js';
import { WaitingRoomInteractionIds } from '../enums/daruma-training.js';
import { DarumaTrainingChannelService } from '../services/dt-channel.js';
import { GameAssets } from '../services/game-assets.js';
import { ChannelSettings, IdtGames } from '../types/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';
import {
  paginatedDarumaEmbed,
  quickJoinDaruma,
  registerPlayer,
  withdrawPlayer,
} from '../utils/functions/dt-embeds.js';
import { buildGameType } from '../utils/functions/dt-utils.js';
import logger from '../utils/functions/logger-factory.js';
import { getDeveloperMentions } from '../utils/functions/owner-utils.js';

@Discord()
@injectable()
@singleton()
export class DarumaTrainingManager {
  public allGames: IdtGames;
  constructor(
    private client: Client,
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(DarumaTrainingChannelService) private dtChannelService: DarumaTrainingChannelService,
  ) {
    this.allGames = new Map();
  }

  async startGameWaitingRoom(channelSettings: DarumaTrainingChannel[]): Promise<void> {
    if (!this.gameAssets.isReady()) {
      logger.error('Game assets are not ready yet! Cannot start waiting rooms.');
      return;
    }
    // Custom function to handle each channel setting
    const handleChannelSetting = async (
      channelSetting: DarumaTrainingChannel,
    ): Promise<{ game: Game; gameSettings: ChannelSettings } | null> => {
      const gameSettings = buildGameType(channelSetting, this.gameAssets.karmaAsset!);
      if (!gameSettings) {
        // Handle the case where gameSettings is null or undefined
        return null;
      }

      try {
        const channel = await this.getChannelFromClient(gameSettings.channelId);
        if (!channel) {
          return null;
        }
        const game = container.resolve(Game);
        await game.initialize(gameSettings, channel);
        return { game, gameSettings };
      } catch (error) {
        logger.error(`Error initializing game for channel ${gameSettings.channelId}`, error);
        return null;
      }
    };

    const gamesCollections = await Promise.all(
      channelSettings.map((element) => handleChannelSetting(element)),
    );

    for (const gameCollection of gamesCollections) {
      if (gameCollection) {
        this.allGames.set(gameCollection.gameSettings.channelId, gameCollection.game);
      }
    }
  }
  async getChannelFromClient(channelId: string): Promise<TextChannel | undefined> {
    let fetchedChannel;
    try {
      fetchedChannel = await this.client.channels.fetch(channelId);
    } catch {
      logger.error(`Could not find channel ${channelId} -- Removing from DB`);
      await this.dtChannelService.deleteChannelById(channelId);
      return;
    }
    // Check if the channel is a TextChannel
    if (!(fetchedChannel instanceof TextChannel)) {
      throw new TypeError(`Channel ${channelId} is not a text-based channel`);
    }

    return fetchedChannel;
  }
  async startWaitingRooms(): Promise<void> {
    const gameChannels = await this.dtChannelService.getAllChannelsByGuildIds(
      this.client.guilds.cache,
    );
    await this.startGameWaitingRoom(gameChannels);
  }

  async startWaitingRoomForChannel(channel: TextBasedChannel | GuildChannel): Promise<boolean> {
    try {
      const gameChannel = await this.dtChannelService.getChannelById(channel.id);
      if (!gameChannel) {
        return false;
      }
      await this.startGameWaitingRoom([gameChannel]);
      return true;
    } catch (error) {
      logger.error('Could not start the waiting room because:', error);
      return false;
    }
  }

  async stopWaitingRoomsOnceGamesEnd(): Promise<void> {
    await Promise.allSettled(
      [...this.allGames.values()].map((game) =>
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
