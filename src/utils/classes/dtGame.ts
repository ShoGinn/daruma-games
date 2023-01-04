import { MikroORM } from '@mikro-orm/core';
import { EmbedBuilder, Message, Snowflake, TextChannel } from 'discord.js';
import { randomInt } from 'node:crypto';
import { container, injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../../entities/AlgoNFTAsset.js';
import { DarumaTrainingChannel } from '../../entities/DtChannel.js';
import { DtEncounters } from '../../entities/DtEncounters.js';
import { User } from '../../entities/User.js';
import {
    GameStatus,
    GameTypes,
    InternalUserIDs,
    renderConfig,
    RenderPhases,
} from '../../enums/dtEnums.js';
import { renderBoard } from '../functions/dtBoard.js';
import { coolDownModified, doEmbed } from '../functions/dtEmbeds.js';
import {
    defaultGameRoundState,
    defaultGameWinInfo,
    IdtPlayers,
    karmaPayoutCalculator,
} from '../functions/dtUtils.js';
import logger from '../functions/LoggerFactory.js';
import { isInMaintenance } from '../functions/maintenance.js';
import { ObjectUtil } from '../Utils.js';
import { Player } from './dtPlayer.js';
/**
 * Main game class
 */
@injectable()
export class Game {
    private _status: GameStatus;
    private players: IdtPlayers;
    public embed: Message;
    private gameRoundState: DarumaTrainingPlugin.GameRoundState;
    public hasNpc: boolean;
    public waitingRoomChannel: TextChannel;
    public gameWinInfo: DarumaTrainingPlugin.gameWinInfo;
    public encounterId: number;
    private orm: MikroORM;
    constructor(private _settings: DarumaTrainingPlugin.ChannelSettings) {
        this.players = {};
        this.gameRoundState = defaultGameRoundState;
        this.gameWinInfo = defaultGameWinInfo;
        this.orm = container.resolve(MikroORM);
    }
    public get settings(): DarumaTrainingPlugin.ChannelSettings {
        return this._settings;
    }
    public set settings(value: DarumaTrainingPlugin.ChannelSettings) {
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
        let waitingRoomEmbed = await doEmbed(GameStatus.waitingRoom, this);
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
    public get playerArray(): Player[] {
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
        const userID =
            InternalUserIDs[
                this.settings.gameType as unknown as keyof typeof InternalUserIDs
            ]?.toString();
        if (userID) {
            const user = await em.getRepository(User).findOneOrFail({ id: userID });
            const asset = await em
                .getRepository(AlgoNFTAsset)
                .findOneOrFail({ id: Number(userID) });
            this.addPlayer(new Player(user, asset.name, asset, true));
            this.hasNpc = true;
        }
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
        let karmaWinningRound = this.gameWinInfo.gameWinRoundIndex + 1;
        this.gameWinInfo.payout = karmaPayoutCalculator(
            karmaWinningRound,
            this.settings.token,
            this.gameWinInfo.zen
        );
    }

    renderThisBoard(renderPhase: RenderPhases): string {
        const board = renderBoard(
            this.gameRoundState.rollIndex,
            this.gameRoundState.roundIndex,
            this.gameRoundState.playerIndex,
            this.playerArray,
            renderPhase
        );
        return board;
    }
    resetGame(): void {
        this.removePlayers();
        this.gameRoundState = { ...defaultGameRoundState };
        this.gameWinInfo = { ...defaultGameWinInfo };
    }
    async startChannelGame(): Promise<void> {
        this.findZenAndWinners();
        await this.saveEncounter();
        await this.embed?.delete();
        let gameEmbed = await doEmbed(GameStatus.activeGame, this);
        const activeGameEmbed = await this.waitingRoomChannel.send({
            embeds: [gameEmbed.embed],
            components: gameEmbed.components,
        });
        this.settings.messageId = undefined;
        await this.gameHandler().then(() => this.execWin());
        gameEmbed = await doEmbed(GameStatus.finished, this);
        await activeGameEmbed.edit({ embeds: [gameEmbed.embed], components: gameEmbed.components });
        await ObjectUtil.delayFor(5 * 1000).then(() => this.sendWaitingRoomEmbed());
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
                let waitingRoomChannel = await this.waitingRoomChannel.messages.fetch(
                    this.settings.messageId
                );
                if (waitingRoomChannel) await waitingRoomChannel.delete();
            }
        } catch (e: any) {
            logger.info(
                `Error when trying to delete the waiting room. ${this.settings.gameType} -- ${this.settings.channelId}`
            );
        }
    }
    async checkIfWaitingRoomExists(): Promise<boolean> {
        await this.waitingRoomChannel.messages.fetch(this.settings.messageId).catch(_e => {
            logger.error(
                `Error when trying to fetch the message for ${this.settings.gameType} -- ${this.settings.channelId} -- Checking if Channel exists.`
            );
            //logger.error(e.stack);
        });
        // Check if the channel exists on this guild
        await this.waitingRoomChannel.guild.channels.fetch(this.waitingRoomChannel.id).catch(_e => {
            logger.info(
                `Channel does not exist for ${this.settings.gameType} -- ${this.settings.channelId}`
            );
            //logger.error(e.stack);
            return false;
        });
        return true;
    }
    async botMaintenance(): Promise<boolean> {
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
        let gameStatusEmbed = await doEmbed(gameStatus, this);
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
        let channelMessage: Message;

        if (process.env.MOCK_BATTLE) {
            logger.info('You are Skipping battles! Hope this is not Production');
            await this.waitingRoomChannel.send('Skipping The Battle.. because well tests');
            await ObjectUtil.delayFor(1000).then(() => (this.status = GameStatus.finished));
        }
        await ObjectUtil.delayFor(1500);

        while (this.status !== GameStatus.finished) {
            const playerArr = this.playerArray;

            // for each player render new board
            for (let index = 0; index < playerArr.length; index++) {
                this.setCurrentPlayer(playerArr[index], index);
                // for each render phase, pass enum to board
                for (const phase in RenderPhases) {
                    const board = this.renderThisBoard(phase as RenderPhases);

                    // if it's the first roll
                    if (!channelMessage) {
                        channelMessage = await this.waitingRoomChannel.send(board);
                    } else {
                        await channelMessage.edit(board);
                    }
                    let minTime = renderConfig[phase].durMin;
                    let maxTime = renderConfig[phase].durMax;

                    if (GameTypes.FourVsNpc === this.settings.gameType) {
                        if (phase === RenderPhases.GIF) {
                            minTime = 1000;
                            maxTime = 1001;
                        }
                    }
                    // ensure that min time is never greater than max time
                    if (minTime > maxTime) {
                        minTime = maxTime;
                    }
                    await ObjectUtil.delayFor(randomInt(minTime, maxTime));
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
        const winningEmbeds: EmbedBuilder[] = [];
        for (const player of this.playerArray) {
            if (player.coolDownModified) {
                winningEmbeds.push(await coolDownModified(player));
            }
            if (player.isWinner) {
                let winnerMessage = await doEmbed<Player>(GameStatus.win, this, player);
                winningEmbeds.push(winnerMessage.embed);
            }
        }
        await this.waitingRoomChannel.send({ embeds: winningEmbeds });
    }
}
