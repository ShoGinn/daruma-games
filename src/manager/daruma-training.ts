import { ButtonInteraction, GuildChannel, TextBasedChannel, TextChannel } from 'discord.js';

import { ButtonComponent, Client, Discord } from 'discordx';

import { container, inject, injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannel } from '../database/dt-channel/dt-channel.schema.js';
import {
  customDeferReply,
  withCustomDiscordApiErrorLogger,
} from '../decorators/discord-error-handler.js';
import { WaitingRoomInteractionIds } from '../enums/daruma-training.js';
import { DarumaTrainingChannelService } from '../services/dt-channel.js';
import { GameAssets } from '../services/game-assets.js';
import { IdtGames } from '../types/daruma-training.js';
import { Game } from '../utils/classes/dt-game.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
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

    const gamesCollections = await this.buildGamesFromChannelSettings(channelSettings);

    this.addGamesToAllGames(gamesCollections);
  }

  async buildGamesFromChannelSettings(
    channelSettings: DarumaTrainingChannel[],
  ): Promise<Array<Game | null>> {
    return await Promise.all(
      channelSettings.map((setting) => this.buildGameFromChannelSetting(setting)),
    );
  }

  async buildGameFromChannelSetting(channelSetting: DarumaTrainingChannel): Promise<Game | null> {
    const gameSettings = buildGameType(channelSetting, this.gameAssets.karmaAsset);
    if (!gameSettings) {
      return null;
    }

    try {
      const channel = await this.getChannelFromClient(gameSettings.channelId);
      if (!channel) {
        return null;
      }
      const game = container.resolve(Game);
      await game.initialize(gameSettings, channel);
      return game;
    } catch (error) {
      logger.error(`Error initializing game for channel ${gameSettings.channelId}`, error);
      return null;
    }
  }

  addGamesToAllGames(games: Array<Game | null>): void {
    for (const game of games) {
      if (game) {
        this.allGames.set(game.settings.channelId, game);
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
      const channelName = InteractionUtils.getInteractionChannelName(interaction);
      const response = `The game in ${channelName} does not exist. Please contact ${getDeveloperMentions()} to resolve this issue.`;
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

    await customDeferReply(interaction);
    await paginatedDarumaEmbed(interaction, this.allGames);
  }

  @ButtonComponent({ id: WaitingRoomInteractionIds.quickJoin })
  @withCustomDiscordApiErrorLogger
  async quickJoin(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await customDeferReply(interaction);
    await quickJoinDaruma(interaction, this.allGames);
  }

  @ButtonComponent({ id: /((daruma-select_)\S*)\b/gm })
  @withCustomDiscordApiErrorLogger
  async selectAsset(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await customDeferReply(interaction);
    await registerPlayer(interaction, this.allGames);
  }

  @ButtonComponent({ id: WaitingRoomInteractionIds.withdrawPlayer })
  async withdrawPlayer(interaction: ButtonInteraction): Promise<void> {
    if (await this.respondWhenGameDoesNotExist(interaction)) {
      return;
    }

    await customDeferReply(interaction);
    await withdrawPlayer(interaction, this.allGames);
  }
}
