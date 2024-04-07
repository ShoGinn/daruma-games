import { Message } from 'discord.js';

import { injectable } from 'tsyringe';

import { MaintenanceService } from '../../services/maintenance.js';
import { doEmbed, postGameWinEmbeds } from '../functions/dt-embeds.js';
import logger from '../functions/logger-factory.js';

import { ChannelUtils } from './channel-utils.js';
import { Game } from './dt-game.js';

@injectable()
export class EmbedManager {
  public waitingRoomEmbed: Message | undefined;
  public activeGameEmbed: Message | undefined;
  public gameBoardMessage: Message | undefined;

  constructor(private maintenanceService: MaintenanceService) {}
  private reset(): void {
    this.waitingRoomEmbed = undefined;
    this.activeGameEmbed = undefined;
    this.gameBoardMessage = undefined;
  }
  private async sendEmbed(game: Game): Promise<Message | undefined> {
    const embed = await doEmbed(game);
    return await game.waitingRoomManager.sendToChannel(embed);
  }
  private async updateMessage(game: Game, existingMessage: Message): Promise<void> {
    try {
      const embed = await doEmbed(game);
      await existingMessage.edit(embed);
    } catch (error) {
      logger.debug('Error updating embed:', error);
      return;
    }
  }
  private async sendWinEmbeds(game: Game): Promise<void> {
    const embed = await postGameWinEmbeds(game);
    await game.waitingRoomManager.sendToChannel(embed);
  }

  public async startGame(game: Game): Promise<void> {
    await this.deleteWaitingRoomMessage();
    this.activeGameEmbed = await this.sendEmbed(game);
    return;
  }
  public async finishGame(game: Game): Promise<void> {
    await this.sendWinEmbeds(game);
    game.updateState(game.state.finishGame());
    if (!this.activeGameEmbed) {
      return;
    }
    await this.updateMessage(game, this.activeGameEmbed);
    await this.sendJoinWaitingRoomEmbed(game);
  }

  public async executeGameBoardMessage(game: Game, board: string): Promise<void> {
    if (!this.gameBoardMessage) {
      this.gameBoardMessage = await game.waitingRoomManager.sendToChannel(board);
      return;
    }
    await this.gameBoardMessage.edit(board);
  }

  private async deleteWaitingRoomMessage(): Promise<void> {
    await ChannelUtils.deleteMessage(this.waitingRoomEmbed);
    this.waitingRoomEmbed = undefined;
  }

  public async sendJoinWaitingRoomEmbed(game: Game): Promise<void> {
    game.updateState(game.state.reset());
    this.reset();
    if (await this.maintenanceService.isInMaintenance()) {
      game.updateState(game.state.maintenance());
    }
    await this.findAndRemoveWaitingRoomMessage(game);
    this.waitingRoomEmbed = await this.sendEmbed(game);
  }
  private async findAndRemoveWaitingRoomMessage(game: Game): Promise<void> {
    // Check if the message exists in the channel
    const message = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(
      game.waitingRoomManager.waitingRoomChannel,
      'Waiting Room',
    );
    await ChannelUtils.deleteMessage(message);
  }

  public async updateWaitingRoomEmbed(game: Game): Promise<void> {
    if (!this.waitingRoomEmbed) {
      return;
    }
    await this.updateMessage(game, this.waitingRoomEmbed);
    if (game.state.canStartGame(game.settings.maxCapacity || 0)) {
      await game.startChannelGame();
    }
  }
}
