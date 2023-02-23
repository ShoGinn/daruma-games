import type {
    ChannelSettings,
    GameRoundState,
    gameWinInfo,
} from '../../model/types/darumaTraining.js';
import { MikroORM } from '@mikro-orm/core';
import { EmbedBuilder, Message, Snowflake, TextChannel } from 'discord.js';
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

interface IdtPlayers {
    [key: string]: Player;
}

/**
 * Main game class
 */
@injectable()
export class Game {
    private _status: GameStatus = GameStatus.maintenance;
    private players: IdtPlayers;
    public embed: Message | undefined;
    private gameRoundState: GameRoundState;
    private gameBoard: DarumaTrainingBoard;
    public hasNpc = false;
    public waitingRoomChannel: TextChannel | null = null;
    public gameWinInfo: gameWinInfo;
    public encounterId: number | null = null;
    private orm: MikroORM;
    constructor(private _settings: ChannelSettings) {
        this.players = {};
        this.gameBoard = new DarumaTrainingBoard();
        this.gameRoundState = defaultGameRoundState;
        this.gameWinInfo = defaultGameWinInfo;
        this.orm = container.resolve(MikroORM);
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
        if (!this.embed) {
            throw new Error('No embed stored in game');
        }
        const waitingRoomEmbed = await doEmbed(GameStatus.waitingRoom, this);
        await this.embed.edit({
            embeds: [waitingRoomEmbed.embed],
            components: waitingRoomEmbed.components,
        });
        if (
            !(
                this.playerCount < this.settings.maxCapacity &&
                this.status === GameStatus.waitingRoom
            )
        ) {
            await this.startChannelGame();
        }
    }
    public get playerArray(): Array<Player> {
        return Object.values(this.players);
    }
    public get playerCount(): number {
        return Object.keys(this.players).length;
    }
    getPlayer<C extends Snowflake>(discordId: C): Player | undefined {
        return this.players[discordId] || undefined;
    }

    addPlayer(player: Player): void {
        if (this.playerCount < 1) {
            this.setCurrentPlayer(player, 0);
        }
        this.players[player.userClass.id] = player;
    }

    removePlayers(): void {
        this.players = {};
    }

    removePlayer<C extends Snowflake>(discordId: C): void {
        if (this.players[discordId]) {
            delete this.players[discordId];
        }
    }

    /*
     * NPC
     */

    async addNpc(): Promise<void> {
        const em = this.orm.em.fork();
        const NPC = GameNPCs.NPCs.find(b => b.gameType === this.settings.gameType);
        if (!NPC) {
            return;
        }
        const botCreator = await em
            .getRepository(User)
            .findOneOrFail({ id: InternalUserIDs.botCreator.toString() });
        const asset = await em.getRepository(AlgoNFTAsset).findOneOrFail({ id: NPC.assetIndex });
        this.addPlayer(new Player(botCreator, asset.name, asset, true));
        this.hasNpc = true;
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

        this.encounterId = await em.getRepository(DtEncounters).createEncounter(this);
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
        await ObjectUtil.delayFor(5_000).then(() => this.sendWaitingRoomEmbed());
    }
    async stopWaitingRoomOnceGameEnds(): Promise<void> {
        if (this.status === GameStatus.waitingRoom) {
            await this.botMaintenance();
        } else {
            return;
        }
    }
    async deleteWaitingRoomEmbed(): Promise<void> {
        try {
            if (this.settings.messageId) {
                const waitingRoomChannel = await this.waitingRoomChannel?.messages.fetch(
                    this.settings.messageId
                );
                if (waitingRoomChannel) await waitingRoomChannel.delete();
            }
        } catch (e) {
            logger.info(
                `Error when trying to delete the waiting room. ${this.settings.gameType} -- ${this.settings.channelId}`
            );
        }
    }
    async checkIfWaitingRoomExists(): Promise<boolean> {
        if (!this.waitingRoomChannel || !this.settings.messageId) return false;
        await this.waitingRoomChannel.messages.fetch(this.settings.messageId).catch(_e => {
            logger.error(
                `Error when trying to fetch the message for ${this.settings.gameType} -- ${this.settings.channelId} -- Checking if Channel exists.`
            );
            //logger.error(e.stack);
        });
        // Check if the channel exists on this guild
        await this.waitingRoomChannel?.guild.channels
            .fetch(this.waitingRoomChannel.id)
            .catch(_e => {
                logger.info(
                    `Channel does not exist for ${this.settings.gameType} -- ${this.settings.channelId}`
                );
                //logger.error(e.stack);
                return false;
            });
        return true;
    }
    async botMaintenance(): Promise<boolean | void> {
        // check if waiting room exists and if it doesn't return
        if (!(await this.checkIfWaitingRoomExists())) return;
        // Delete the waiting room embed
        await this.deleteWaitingRoomEmbed();
        // check if the channel is in maintenance
        if (await isInMaintenance()) {
            // send the maintenance embed
            await this.sendEmbedAndUpdateMessageId(GameStatus.maintenance);
            return true;
        }
        return false;
    }
    async sendEmbedAndUpdateMessageId(gameStatus: GameStatus): Promise<void> {
        const em = this.orm.em.fork();
        const gameStatusEmbed = await doEmbed(gameStatus, this);
        this.embed = await this.waitingRoomChannel
            ?.send({ embeds: [gameStatusEmbed.embed], components: gameStatusEmbed.components })
            .then(msg => {
                this.settings.messageId = msg.id;
                void em
                    .getRepository(DarumaTrainingChannel)
                    .updateMessageId(this._settings.channelId, msg.id);
                return msg;
            });
    }
    async sendWaitingRoomEmbed(): Promise<void> {
        if (!this.waitingRoomChannel) {
            logger.error(`Waiting Room Channel is undefined`);
            return;
        }

        this.resetGame();

        if (await this.botMaintenance()) return;

        await this.addNpc();
        await this.sendEmbedAndUpdateMessageId(GameStatus.waitingRoom);
    }

    async gameHandler(): Promise<void> {
        let channelMessage: Message | undefined;

        if (process.env.MOCK_BATTLE) {
            logger.info('You are Skipping battles! Hope this is not Production');
            await this.waitingRoomChannel?.send('Skipping The Battle.. because well tests');
            await ObjectUtil.delayFor(1000).then(() => (this.status = GameStatus.finished));
        }
        await ObjectUtil.delayFor(1500);

        while (this.status !== GameStatus.finished) {
            // for each player render new board
            for (const [i, player] of this.playerArray.entries()) {
                this.setCurrentPlayer(player, i);
                // for each render phase, pass enum to board
                for (const phase in RenderPhases) {
                    const board = this.renderThisBoard(phase as RenderPhases);

                    // if it's the first roll
                    if (channelMessage) {
                        await channelMessage.edit(board);
                    } else {
                        channelMessage = await this.waitingRoomChannel?.send(board);
                    }
                    const [minTime, maxTime] =
                        GameTypes.FourVsNpc === this.settings.gameType && phase === RenderPhases.GIF
                            ? [1000, 1001]
                            : [renderConfig[phase].durMin, renderConfig[phase].durMax];
                    await ObjectUtil.delayFor(randomInt(Math.min(minTime, maxTime), maxTime));
                }
            }
            if (this.status !== GameStatus.activeGame) {
                break;
            }
            // proceed to next roll
            this.incrementRollIndex();
        }
    }
    /**
     * Send a winning embed for each winning player
     * @param game {Game}
     * @param channel {TextChannel}
     */
    async execWin(): Promise<void> {
        // Create an array of winning embeds
        const winningEmbeds: Array<EmbedBuilder> = [];
        for (const player of this.playerArray) {
            if (player.coolDownModified) {
                winningEmbeds.push(await coolDownModified(player, this.settings.coolDown));
            }
            if (player.isWinner) {
                const winnerMessage = await doEmbed<Player>(GameStatus.win, this, player);
                winningEmbeds.push(winnerMessage.embed);
            }
        }
        await this.waitingRoomChannel?.send({ embeds: winningEmbeds });
    }
}
