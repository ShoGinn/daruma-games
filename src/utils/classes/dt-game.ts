import type {
    ChannelSettings,
    GameRoundState,
    gameWinInfo,
} from '../../model/types/daruma-training.js';
import { MikroORM } from '@mikro-orm/core';
import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingBoard } from './dt-board.js';
import { Player } from './dt-player.js';
import { AlgoNFTAsset } from '../../entities/algo-nft-asset.entity.js';
import { DarumaTrainingChannel } from '../../entities/dt-channel.entity.js';
import { DtEncounters } from '../../entities/dt-encounters.entity.js';
import { User } from '../../entities/user.entity.js';
import {
    defaultDelayTimes,
    GameNPCs,
    GameStatus,
    GameTypes,
    GIF_RENDER_PHASE,
    IGameBoardRender,
    IGameNPC,
    InternalUserIDs,
    renderConfig,
    RenderPhase,
    renderPhasesArray,
} from '../../enums/daruma-training.js';
import { getTemporaryPayoutModifier } from '../functions/dt-boost.js';
import { coolDownModified, doEmbed } from '../functions/dt-embeds.js';
import {
    defaultGameRoundState,
    defaultGameWinInfo,
    karmaPayoutCalculator,
} from '../functions/dt-utils.js';
import logger from '../functions/logger-factory.js';
import { isInMaintenance } from '../functions/maintenance.js';
import { ObjectUtil } from '../utils.js';

/**
 * Main game class
 */
@injectable()
export class Game {
    public status: GameStatus = GameStatus.maintenance;
    public gameRoundState: GameRoundState = { ...defaultGameRoundState };
    public gameWinInfo: gameWinInfo = { ...defaultGameWinInfo };
    public players: Array<Player> = [];
    public embed: Message | undefined;
    private gameBoard: DarumaTrainingBoard = new DarumaTrainingBoard();
    public waitingRoomChannel: TextChannel | null = null;
    public encounterId: number | null = null;
    private orm: MikroORM;
    constructor(public settings: ChannelSettings) {
        this.orm = container.resolve(MikroORM);
    }
    public get getNPC(): IGameNPC | undefined {
        return GameNPCs.find(npc => npc.gameType === this.settings.gameType);
    }
    getPlayer(discordId: string): Player | undefined {
        return this.players.find(player => player.dbUser.id === discordId);
    }
    getPlayerIndex(discordId: string): number {
        return this.players.findIndex(player => player.dbUser.id === discordId);
    }
    resetGame(): void {
        this.removeAllPlayers();
        this.gameRoundState = { ...defaultGameRoundState };
        this.gameWinInfo = { ...defaultGameWinInfo };
        this.gameBoard = new DarumaTrainingBoard();
    }
    removeAllPlayers(): void {
        this.players = [];
    }

    removePlayer(discordId: string): boolean {
        const playerIndex = this.getPlayerIndex(discordId);
        if (playerIndex >= 0) {
            this.players.splice(playerIndex, 1);
            return true;
        }
        return false;
    }
    setCurrentPlayer(player: Player, playerIndex: number): void {
        this.gameRoundState.currentPlayer = player;
        this.gameRoundState.playerIndex = playerIndex;
    }

    async addNpc(): Promise<boolean> {
        if (!this.getNPC) {
            return false;
        }
        const em = this.orm.em.fork();
        const [botCreator, asset] = await Promise.all([
            em.getRepository(User).findOne({ id: InternalUserIDs.botCreator.toString() }),
            em.getRepository(AlgoNFTAsset).findOne({ id: this.getNPC?.assetIndex }),
        ]);
        if (!botCreator || !asset) {
            logger.error('Error adding NPC to game');
            return false;
        }
        return this.addPlayer(new Player(botCreator, asset));
    }

    addPlayer(player: Player): boolean {
        if (this.getPlayer(player.dbUser.id)) {
            if (this.getPlayer(player.dbUser.id)?.playableNFT.id != player.playableNFT.id) {
                const playerIndex = this.getPlayerIndex(player.dbUser.id);
                if (playerIndex >= 0) {
                    const currentPlayer = this.players[playerIndex];
                    if (currentPlayer) {
                        currentPlayer.playableNFT = player.playableNFT;
                    }
                }
            }
            return true;
        }

        if (this.players.length === 0) {
            this.setCurrentPlayer(player, 0);
        }
        this.players.push(player);
        return true;
    }
    async endGamePlayerUpdate(): Promise<void> {
        for (const player of this.players) {
            await player.userAndAssetEndGameUpdate(this.gameWinInfo, this.settings.coolDown);
        }
    }
    async saveEncounter(): Promise<void> {
        await this.endGamePlayerUpdate();
        const em = this.orm.em.fork();
        const encounter = await em.getRepository(DtEncounters).createEncounter(this);
        this.encounterId = encounter.id;
    }

    nextRoll(): void {
        if (this.status === GameStatus.win) {
            return;
        }

        if (this.shouldIncrementRound()) {
            this.nextRound();
        } else {
            this.gameRoundState.rollIndex++;
        }
        this.checkForWin();
    }
    shouldIncrementRound(): boolean {
        const { rollIndex } = this.gameRoundState;
        return (rollIndex + 1) % 3 === 0;
    }

    nextRound(): void {
        this.gameRoundState.roundIndex++;
        this.gameRoundState.rollIndex = 0;
    }
    checkForWin(): void {
        const { currentPlayer, roundIndex, rollIndex } = this.gameRoundState;
        const { gameWinRoundIndex, gameWinRollIndex } = this.gameWinInfo;

        if (currentPlayer && roundIndex === gameWinRoundIndex && rollIndex === gameWinRollIndex) {
            this.status = GameStatus.win;
        }
    }
    /**
     * Compares the stored round and roll index to each players winning round and roll index
     * Stores winning players in an array
     * @param {number} [payoutModifier]
     */
    findZenAndWinners(payoutModifier?: number | undefined): void {
        // Find the playerArray with both the lowest round and roll index
        for (const player of this.players) {
            const winningRollIndex = player.roundsData.gameWinRollIndex;
            const winningRoundIndex = player.roundsData.gameWinRoundIndex;

            if (winningRoundIndex < this.gameWinInfo.gameWinRoundIndex) {
                this.gameWinInfo.gameWinRoundIndex = winningRoundIndex;
                this.gameWinInfo.gameWinRollIndex = winningRollIndex;
            } else if (
                winningRoundIndex === this.gameWinInfo.gameWinRoundIndex &&
                winningRollIndex < this.gameWinInfo.gameWinRollIndex
            ) {
                this.gameWinInfo.gameWinRollIndex = winningRollIndex;
            }
        }
        // Find the number of players with zen
        let zenCount = 0;
        for (const player of this.players) {
            const winningRollIndex = player.roundsData.gameWinRollIndex;
            const winningRoundIndex = player.roundsData.gameWinRoundIndex;
            if (
                winningRollIndex === this.gameWinInfo.gameWinRollIndex &&
                winningRoundIndex === this.gameWinInfo.gameWinRoundIndex
            ) {
                player.isWinner = true;
                zenCount++;
            }
        }
        this.gameWinInfo.zen = zenCount > 1;
        // Calculate the payout
        const karmaWinningRound = this.gameWinInfo.gameWinRoundIndex + 1;
        this.gameWinInfo.payout = karmaPayoutCalculator(
            karmaWinningRound,
            this.settings.token,
            this.gameWinInfo.zen,
            payoutModifier
        );
    }
    renderThisBoard(renderPhase: RenderPhase): string {
        const gameBoardRender: IGameBoardRender = {
            players: this.players,
            roundState: {
                rollIndex: this.gameRoundState.rollIndex,
                roundIndex: this.gameRoundState.roundIndex,
                playerIndex: this.gameRoundState.playerIndex,
                phase: renderPhase,
            },
        };
        return this.gameBoard.renderBoard(gameBoardRender);
    }
    async phaseDelay(phase: RenderPhase, executeWait: boolean = true): Promise<Array<number>> {
        const [minTime, maxTime] =
            GameTypes.FourVsNpc === this.settings.gameType && phase === GIF_RENDER_PHASE
                ? [defaultDelayTimes.minTime, defaultDelayTimes.maxTime]
                : [renderConfig[phase].durMin, renderConfig[phase].durMax];
        if (executeWait) {
            await ObjectUtil.randomDelayFor(minTime, maxTime);
        }
        return [minTime, maxTime];
    }

    async startChannelGame(): Promise<void> {
        const payoutModifier = await getTemporaryPayoutModifier();
        this.findZenAndWinners(payoutModifier);
        await this.saveEncounter();
        await this.embed?.delete().catch(() => null);
        let gameEmbed = await doEmbed(GameStatus.activeGame, this);
        const activeGameEmbed = await this.waitingRoomChannel?.send({
            embeds: [gameEmbed.embed],
            components: gameEmbed.components,
        });
        this.settings.messageId = undefined;
        await this.gameHandler();
        await this.execWin();
        gameEmbed = await doEmbed(GameStatus.finished, this);
        await activeGameEmbed?.edit({
            embeds: [gameEmbed.embed],
            components: gameEmbed.components,
        });
        await this.sendWaitingRoomEmbed(true);
    }
    async stopWaitingRoomOnceGameEnds(): Promise<void> {
        if (this.status === GameStatus.waitingRoom) {
            await this.sendWaitingRoomEmbed(false, true);
        } else {
            return;
        }
    }
    async checkWaitingRoomChannel(): Promise<boolean> {
        if (!this.waitingRoomChannel) {
            return false;
        }
        // Check if the channel exists on this guild
        try {
            await this.waitingRoomChannel.guild.channels.fetch(this.waitingRoomChannel.id);
            return true;
        } catch {
            logger.info(
                `Channel does not exist for ${this.settings.gameType} -- ${this.settings.channelId}`
            );
            return false;
        }
    }
    async checkWaitingRoomMessage(): Promise<Message<true> | undefined> {
        if (!this.waitingRoomChannel || !this.settings.messageId) {
            return;
        }
        // Check if the message exists in the channel
        try {
            return await this.waitingRoomChannel.messages.fetch(this.settings.messageId);
        } catch {
            logger.info(
                `Message does not exist for ${this.settings.gameType} -- ${this.settings.channelId}`
            );
            return;
        }
    }
    async checkIfWaitingRoomChannelExists(deleteRoom: boolean = false): Promise<boolean> {
        const channelExists = await this.checkWaitingRoomChannel();
        if (deleteRoom && channelExists) {
            const waitingRoomMessage = await this.checkWaitingRoomMessage();
            if (waitingRoomMessage) {
                try {
                    await waitingRoomMessage.delete();
                } catch {
                    logger.error(
                        `Error when trying to delete the waiting room. ${this.settings.gameType} -- ${this.settings.channelId}`
                    );
                }
            }
        }
        return channelExists;
    }

    async sendWaitingRoomEmbed(
        newGame: boolean = false,
        deleteRoom: boolean = false
    ): Promise<void> {
        this.resetGame();
        let gameStatus = GameStatus.waitingRoom;
        if (await isInMaintenance()) {
            gameStatus = GameStatus.maintenance;
        }
        const channelExists = await this.checkIfWaitingRoomChannelExists(deleteRoom);
        if (channelExists || newGame) {
            await this.addNpc();
            await this.sendEmbedAndUpdateMessageId(gameStatus);
        }
    }
    async sendEmbedAndUpdateMessageId(gameStatus: GameStatus): Promise<void> {
        const em = this.orm.em.fork();

        const gameStatusEmbed = await doEmbed(gameStatus, this);

        const sentMessage = await this.waitingRoomChannel?.send({
            embeds: [gameStatusEmbed.embed],
            components: gameStatusEmbed.components,
        });

        if (sentMessage) {
            this.settings.messageId = sentMessage.id;
            await em
                .getRepository(DarumaTrainingChannel)
                .updateMessageId(this.settings.channelId, sentMessage.id);
        }

        this.embed = sentMessage;
    }
    public async updateEmbed(): Promise<void> {
        try {
            const waitingRoomEmbed = await doEmbed(GameStatus.waitingRoom, this);
            await this.embed?.edit({
                embeds: [waitingRoomEmbed.embed],
                components: waitingRoomEmbed.components,
            });
        } catch (error) {
            logger.debug('Error updating embed:', error);
            return;
        }

        if (this.canStartGame()) {
            await this.startChannelGame();
        }
    }
    private canStartGame(): boolean {
        return (
            this.players.length >= this.settings.maxCapacity &&
            this.status === GameStatus.waitingRoom
        );
    }
    async gameHandler(): Promise<void> {
        try {
            let channelMessage: Message | undefined;
            let gameFinished = false;

            while (!gameFinished) {
                for (const [index, player] of this.players.entries()) {
                    this.setCurrentPlayer(player, index);

                    for (const phase of renderPhasesArray) {
                        const board = this.renderThisBoard(phase);

                        if (channelMessage) {
                            await channelMessage.edit(board);
                        } else {
                            channelMessage = await this.waitingRoomChannel?.send(board);
                        }
                        await this.phaseDelay(phase);
                    }
                }

                if (this.status === GameStatus.activeGame) {
                    this.nextRoll();
                } else {
                    gameFinished = true;
                }
            }
        } catch (error) {
            logger.error(`Error in gameHandler: ${JSON.stringify(error)}`);
            this.status = GameStatus.finished;
        }
    }

    /**
     * Executes the win logic for the game
     *
     * @returns {*}  {Promise<void>}
     * @memberof Game
     */
    async execWin(): Promise<void> {
        if (!this.waitingRoomChannel || !(this.waitingRoomChannel instanceof TextChannel)) {
            logger.warn(`Invalid waiting room channel: ${this.waitingRoomChannel ?? 'undefined'}`);
            return;
        }

        const winningEmbeds = await Promise.all(
            this.players.map(async player => {
                const embeds: EmbedBuilder[] = [];
                if (player.coolDownModified) {
                    embeds.push(await coolDownModified(player, this.settings.coolDown));
                }
                if (player.isWinner) {
                    const isWinnerEmbed = await doEmbed<Player>(GameStatus.win, this, player);
                    embeds.push(isWinnerEmbed.embed);
                }
                return embeds;
            })
        ).then(embedsArray => embedsArray.flat());

        await this.waitingRoomChannel.send({ embeds: winningEmbeds });
    }
}
