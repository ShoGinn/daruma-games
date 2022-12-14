import { BaseMessageOptions, Message, Snowflake, TextChannel } from 'discord.js';
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
import { Database } from '../../services/Database.js';
import { doEmbed } from '../functions/dtEmbeds.js';
import {
    defaultGameRoundState,
    defaultGameWinInfo,
    IdtPlayers,
    karmaPayoutCalculator,
    randomNumber,
} from '../functions/dtUtils.js';
import logger from '../functions/LoggerFactory.js';
import { ObjectUtil } from '../Utils.js';
import { renderBoard } from './dtBoard.js';
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
    private db: Database;
    constructor(private _settings: DarumaTrainingPlugin.ChannelSettings) {
        this.players = {};
        this.gameRoundState = defaultGameRoundState;
        this.gameWinInfo = defaultGameWinInfo;
        this.db = container.resolve(Database);
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
        await this.editEmbed(await doEmbed(GameStatus.waitingRoom, this));
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

    async editEmbed(options: BaseMessageOptions): Promise<void> {
        if (!this.embed) {
            throw new Error('No embed stored in game');
        }
        await this.embed.edit(options);
    }

    /*
     * NPC
     */

    async addNpc(): Promise<void> {
        const userID =
            InternalUserIDs[
                this.settings.gameType as unknown as keyof typeof InternalUserIDs
            ]?.toString();
        if (userID) {
            const user = await this.db.get(User).findOneOrFail({ id: userID });
            const asset = await this.db
                .get(AlgoNFTAsset)
                .findOneOrFail({ assetIndex: Number(userID) });
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
        const pArr = this.playerArray.map(async player => {
            await player.userAndAssetEndGameUpdate(this.gameWinInfo, this.settings.coolDown);
        });
        await Promise.all(pArr);

        this.encounterId = await this.db.get(DtEncounters).createEncounter(this);
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
        const activeGameEmbed = await this.waitingRoomChannel.send(
            await doEmbed(GameStatus.activeGame, this)
        );
        this.settings.messageId = undefined;
        await this.gameHandler().then(() => this.execWin());
        await activeGameEmbed.edit(await doEmbed(GameStatus.finished, this));
        await ObjectUtil.delayFor(5 * 1000).then(() => this.sendWaitingRoomEmbed());
    }

    async sendWaitingRoomEmbed(): Promise<void> {
        this.resetGame();
        try {
            await this.waitingRoomChannel.messages.fetch(this.settings.messageId).catch(e => {
                logger.error(
                    `Error when trying to fetch the message for ${this.settings.gameType} -- ${this.settings.channelId} -- Creating new message`
                );
                logger.error(e);
            });
        } catch (e: any) {
            logger.error(
                `Error when trying to fetch the message for ${this.settings.gameType} -- ${this.settings.channelId} -- Checking if the channel exists`
            );
            return;
        }

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
            logger.info(e);
        }

        await this.addNpc();

        this.embed = await this.waitingRoomChannel
            ?.send(await doEmbed(GameStatus.waitingRoom, this))
            .then(msg => {
                this.settings.messageId = msg.id;
                void this.db
                    .get(DarumaTrainingChannel)
                    .updateMessageId(this._settings.channelId, msg.id);
                return msg;
            });
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
                    const maxModifier = this.settings.gameType === GameTypes.FourVsNpc ? 2500 : 0;
                    await ObjectUtil.delayFor(
                        randomNumber(
                            renderConfig[phase].durMin,
                            renderConfig[phase].durMax - maxModifier
                        )
                    );
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
        for (const player of this.playerArray) {
            if (player.isWinner) {
                await this.waitingRoomChannel.send(
                    await doEmbed<Player>(GameStatus.win, this, player)
                );
            }
        }
    }
}
