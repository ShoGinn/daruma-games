import { Client, Message, MessageCreateOptions, MessagePayload, TextChannel } from 'discord.js';

import { GameStatus } from '../../enums/daruma-training.js';
import { removeChannelFromDatabase } from '../../repositories/dt-channel-repository.js';
import logger from '../functions/logger-factory.js';

import { Game } from './dt-game.js';

export class WaitingRoomManager {
  private game: Game;
  public waitingRoomChannel?: TextChannel;

  constructor(game: Game) {
    this.game = game;
  }
  async initialize(client: Client): Promise<void> {
    try {
      this.waitingRoomChannel = (await client.channels.fetch(
        this.game.settings.channelId,
      )) as TextChannel;
    } catch {
      logger.error(`Could not find channel ${this.game.settings.channelId} -- Removing from DB`);
      await removeChannelFromDatabase(this.game.settings.channelId);
      return;
    }
    logger.info(
      `Channel ${this.waitingRoomChannel.name} (${this.waitingRoomChannel.id}) of type ${this.game.settings.gameType} has been started`,
    );
    await this.game.embedManager.sendJoinWaitingRoomEmbed(this.game);
  }
  async sendToChannel(
    content: string | MessagePayload | MessageCreateOptions,
  ): Promise<Message<boolean> | undefined> {
    return await this.waitingRoomChannel?.send(content);
  }

  async stopWaitingRoomOnceGameEnds(): Promise<void> {
    if (this.game.state.status === GameStatus.waitingRoom) {
      await this.game.embedManager.sendJoinWaitingRoomEmbed(this.game);
    } else {
      return;
    }
  }
}
