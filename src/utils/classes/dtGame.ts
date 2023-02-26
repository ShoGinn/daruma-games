import type {
    ChannelSettings,
    GameRoundState,
    gameWinInfo,
} from '../../model/types/darumaTraining.js';
import { MikroORM } from '@mikro-orm/core';
import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { randomInt } from 'node:crypto';
import { container, injectable } from 'tsyringe';

import { DarumaTrainingBoard } from './dtBoard.js';
import { Player } from './dtPlayer.js';
import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.entity.js';
import { DarumaTrainingChannel } from '../../entities/DtChannel.entity.js';
import { DtEncounters } from '../../entities/DtEncounters.entity.js';
import { User } from '../../entities/User.entity.js';
import {
    GameNPCs,
    GameStatus,
    GameTypes,
    IGameNPC,
    InternalUserIDs,
    renderConfig,
    RenderPhases,
} from '../../enums/dtEnums.js';
import { coolDownModified, doEmbed } from '../functions/dtEmbeds.js';
import {
    defaultGameRoundState,
    defaultGameWinInfo,
    karmaPayoutCalculator,
} from '../functions/dtUtils.js';
import logger from '../functions/LoggerFactory.js';
import { isInMaintenance } from '../functions/maintenance.js';
import { ObjectUtil } from '../Utils.js';

/**
 * Main game class
 */
@injectable()
export class Game {
    private _status: GameStatus = GameStatus.maintenance;
    private players: Array<Player>;
    public embed: Message | undefined;
    private gameRoundState: GameRoundState;
    private gameBoard: DarumaTrainingBoard;
    public waitingRoomChannel: TextChannel | null = null;
    public gameWinInfo: gameWinInfo;
    public encounterId: number | null = null;
    private orm: MikroORM;
    constructor(private _settings: ChannelSettings) {
        this.players = [];
        this.gameBoard = new DarumaTrainingBoard();
        this.gameRoundState = defaultGameRoundState;
        this.gameWinInfo = defaultGameWinInfo;
        this.orm = container.resolve(MikroORM);
    }
    public get npc(): IGameNPC | undefined {
        return GameNPCs.find(npc => npc.gameType === this.settings.gameType);
    }
    public get settings(): ChannelSettings {
        return this._settings;
    }
    public set settings(value: ChannelSettings) {
        this._settings = value;
    }
    public get status(): GameStatus {
        return this._status;
    }
    public set status(value: GameStatus) {
        this._status = value;
    }
    public async updateEmbed(): Promise<void> {
        try {
            const waitingRoomEmbed = await doEmbed(GameStatus.waitingRoom, this);
            await this.embed?.edit({
                embeds: [waitingRoomEmbed.embed],
                components: waitingRoomEmbed.components,
            });
        } catch (error) {
            logger.error('Error updating embed:', error);
            return;
        }

        if (this.canStartGame()) {
            await this.startChannelGame();
        }
    }
    private canStartGame(): boolean {
        return (
            this.playerCount >= this.settings.maxCapacity && this.status === GameStatus.waitingRoom
        );
    }
    public get playerArray(): Array<Player> {
        return this.players;
    }
    public get playerCount(): number {
        return this.players.length;
    }
    getPlayer(discordId: string): Player | undefined {
        return this.players.find(player => player.userClass.id === discordId);
    }
    getPlayerIndex(discordId: string): number {
        return this.players.findIndex(player => player.userClass.id === discordId);
    }
    addPlayer(player: Player): void {
        if (this.getPlayer(player.userClass.id)) {
            // check if the player asset is the same
            if (this.getPlayer(player.userClass.id)?.asset.id != player.asset.id) {
                const playerIndex = this.getPlayerIndex(player.userClass.id);
                if (playerIndex >= 0) {
                    this.players[playerIndex].asset = player.asset;
                }
            }
            return;
        }

        if (this.playerCount < 1) {
            this.setCurrentPlayer(player, 0);
        }
        this.players.push(player);
    }

    removePlayers(): void {
        this.players = [];
    }

    removePlayer(discordId: string): void {
        const playerIndex = this.getPlayerIndex(discordId);
        if (playerIndex >= 0) {
            this.players.splice(playerIndex, 1);
        }
    }
    /*
     * NPC
     */

    async addNpc(): Promise<void> {
        if (!this.npc) {
            return;
        }
        const em = this.orm.em.fork();
        const [botCreator, asset] = await Promise.all([
            em.getRepository(User).findOne({ id: InternalUserIDs.botCreator.toString() }),
            em.getRepository(AlgoNFTAsset).findOne({ id: this.npc?.assetIndex }),
        ]);
        if (!botCreator || !asset) {
            logger.error('Error adding NPC to game');
            return;
        }
        this.addPlayer(new Player(botCreator, asset));
    }

    /*
     * Settings
     */

    setCurrentPlayer(player: Player, playerIndex: number): void {
        this.gameRoundState.currentPlayer = player;
        this.gameRoundState.playerIndex = playerIndex;
    }

    incrementRollIndex(): void {
        if (this.status !== GameStatus.win) {
            // If the roll index is divisible by 3, increment the round index
            if ((this.gameRoundState.rollIndex + 1) % 3 === 0) {
                this.gameRoundState.roundIndex++;
                this.gameRoundState.rollIndex = 0;
            } else {
                this.gameRoundState.rollIndex++;
            }

            // handle win if win
            if (
                this.gameRoundState.currentPlayer &&
                this.gameRoundState.roundIndex === this.gameWinInfo.gameWinRoundIndex &&
                this.gameRoundState.rollIndex === this.gameWinInfo.gameWinRollIndex
            ) {
                this.status = GameStatus.win;
            }
        }
    }

    /*
     * OPERATIONS
     */
    async saveEncounter(): Promise<void> {
        const em = this.orm.em.fork();
        const pArr = this.playerArray.map(async player => {
            await player.userAndAssetEndGameUpdate(this.gameWinInfo, this.settings.coolDown);
        });
        await Promise.all(pArr);

        const encounter = await em.getRepository(DtEncounters).createEncounter(this);
        this.encounterId = encounter.id;
    }
    /**
     * Compares the stored round and roll index to each players winning round and roll index
     * Stores winning players in an array
     */
    findZenAndWinners(): void {
        // Find the playerArray with both the lowest round and roll index
        this.playerArray.forEach((player: Player) => {
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
        });
        // Find the number of players with zen
        let zenCount = 0;
        this.playerArray.forEach((player: Player) => {
            const winningRollIndex = player.roundsData.gameWinRollIndex;
            const winningRoundIndex = player.roundsData.gameWinRoundIndex;
            if (
                winningRollIndex === this.gameWinInfo.gameWinRollIndex &&
                winningRoundIndex === this.gameWinInfo.gameWinRoundIndex
            ) {
                player.isWinner = true;
                zenCount++;
            }
        });
        this.gameWinInfo.zen = zenCount > 1;
        // Calculate the payout
        const karmaWinningRound = this.gameWinInfo.gameWinRoundIndex + 1;
        this.gameWinInfo.payout = karmaPayoutCalculator(
            karmaWinningRound,
            this.settings.token,
            this.gameWinInfo.zen
        );
    }
    renderThisBoard(renderPhase: RenderPhases): string {
        return this.gameBoard.renderBoard(
            this.gameRoundState.rollIndex,
            this.gameRoundState.roundIndex,
            this.gameRoundState.playerIndex,
            this.playerArray,
            renderPhase
        );
    }
    resetGame(): void {
        this.removePlayers();
        this.gameRoundState = { ...defaultGameRoundState };
        this.gameWinInfo = { ...defaultGameWinInfo };
    }
    async startChannelGame(): Promise<void> {
        this.findZenAndWinners();
        await Promise.all([this.saveEncounter(), this.embed?.delete()]);
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
        this.resetGame();
        await ObjectUtil.delayFor(5_000);
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
        if (!this.waitingRoomChannel) return false;
        // Check if the channel exists on this guild
        try {
            await this.waitingRoomChannel.guild.channels.fetch(this.waitingRoomChannel.id);
            return true;
        } catch (e) {
            logger.info(
                `Channel does not exist for ${this.settings.gameType} -- ${this.settings.channelId}`
            );
            return false;
        }
    }
    async checkWaitingRoomMessage(): Promise<Message<true> | undefined> {
        if (!this.waitingRoomChannel || !this.settings.messageId) return;
        // Check if the message exists in the channel
        try {
            return await this.waitingRoomChannel.messages.fetch(this.settings.messageId);
        } catch (e) {
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
                } catch (e) {
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
        let gameStatus = GameStatus.waitingRoom;
        if (await isInMaintenance()) gameStatus = GameStatus.maintenance;
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

    async gameHandler(): Promise<void> {
        try {
            if (await this.isMockBottle()) return;

            await ObjectUtil.delayFor(1500);

            let channelMessage: Message | undefined;
            let gameFinished = false;

            while (!gameFinished) {
                for (const [i, player] of this.playerArray.entries()) {
                    this.setCurrentPlayer(player, i);

                    for (const phase in RenderPhases) {
                        const board = this.renderThisBoard(phase as RenderPhases);

                        if (channelMessage) {
                            await channelMessage.edit(board);
                        } else {
                            channelMessage = await this.waitingRoomChannel?.send(board);
                        }

                        const [minTime, maxTime] =
                            GameTypes.FourVsNpc === this.settings.gameType &&
                            phase === RenderPhases.GIF
                                ? [1000, 1001]
                                : [renderConfig[phase].durMin, renderConfig[phase].durMax];
                        await ObjectUtil.delayFor(randomInt(Math.min(minTime, maxTime), maxTime));
                    }
                }

                if (this.status === GameStatus.activeGame) {
                    this.incrementRollIndex();
                } else {
                    gameFinished = true;
                }
            }
        } catch (error) {
            logger.error(`Error in gameHandler: ${error}`);
            this.status = GameStatus.finished;
        }
    }
    async isMockBottle(): Promise<boolean> {
        if (process.env.MOCK_BATTLE) {
            logger.info('You are Skipping battles! Hope this is not Production');
            await this.waitingRoomChannel?.send('Skipping The Battle.. because well tests');
            await ObjectUtil.delayFor(1000);
            this.status = GameStatus.finished;
            return true;
        }
        return false;
    }

    /**
     * Send a winning embed for each winning player
     * @param game {Game}
     * @param channel {TextBaseChannel}
     */
    async execWin(): Promise<void> {
        if (!this.waitingRoomChannel || !(this.waitingRoomChannel instanceof TextChannel)) {
            logger.warn(`Invalid waiting room channel: ${this.waitingRoomChannel}`);
            return;
        }

        const winningEmbeds = await Promise.all(
            this.playerArray.map(async player => {
                const embeds: EmbedBuilder[] = [];
                if (player.coolDownModified) {
                    embeds.push(await coolDownModified(player, this.settings.coolDown));
                }
                if (player.isWinner) {
                    embeds.push((await doEmbed<Player>(GameStatus.win, this, player)).embed);
                }
                return embeds;
            })
        ).then(embedsArray => embedsArray.flat());

        await this.waitingRoomChannel.send({ embeds: winningEmbeds });
    }
}
