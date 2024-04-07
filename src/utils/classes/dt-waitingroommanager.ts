import { Message, MessageCreateOptions, MessagePayload, TextChannel } from 'discord.js';

import { injectable } from 'tsyringe';

import { GameStatus } from '../../enums/daruma-training.js';
import logger from '../functions/logger-factory.js';

import { Game } from './dt-game.js';

@injectable()
export class WaitingRoomManager {
  public waitingRoomChannel?: TextChannel;
  public game?: Game;
  async initialize(game: Game, channel: TextChannel): Promise<void> {
    this.game = game;
    this.waitingRoomChannel = channel;
    await this.game.embedManager.sendJoinWaitingRoomEmbed(this.game);
    logger.info(
      `Channel ${this.waitingRoomChannel.name} (${this.waitingRoomChannel.id}) of type ${this.game.settings.gameType} has been started`,
    );
  }
  async sendToChannel(
    content: string | MessagePayload | MessageCreateOptions,
  ): Promise<Message | undefined> {
    return await this.waitingRoomChannel?.send(content);
  }

  async stopWaitingRoomOnceGameEnds(): Promise<void> {
    if (this.game?.state.status === GameStatus.waitingRoom) {
      await this.game.embedManager.sendJoinWaitingRoomEmbed(this.game);
    } else {
      return;
    }
  }
}
