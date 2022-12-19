import { MikroORM } from '@mikro-orm/core';
import { ButtonInteraction, TextChannel } from 'discord.js';
import { ButtonComponent, Client, Discord, Guard } from 'discordx';
import { injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannel } from '../entities/DtChannel.js';
import { waitingRoomInteractionIds } from '../enums/dtEnums.js';
import { Game } from '../utils/classes/dtGame.js';
import {
    paginatedDarumaEmbed,
    registerPlayer,
    withdrawPlayer,
} from '../utils/functions/dtEmbeds.js';
import { gatherEmojis } from '../utils/functions/dtEmojis.js';
import { buildGameType } from '../utils/functions/dtUtils.js';
import logger from '../utils/functions/LoggerFactory.js';

@Discord()
@injectable()
@singleton()
export class DarumaTrainingManager {
    constructor(private client: Client, private orm: MikroORM) {}

    public allGames: Record<string, Game> = {};

    async startWaitingRooms(): Promise<void> {
        gatherEmojis(this.client);
        const em = this.orm.em.fork();
        const gameChannels = await em.getRepository(DarumaTrainingChannel).findAll();
        const pArr: Promise<{
            game: Game;
            gameSettings: DarumaTrainingPlugin.ChannelSettings;
        }>[] = gameChannels.map(async channelSettings => {
            const gameSettings = buildGameType(channelSettings);
            const game = new Game(gameSettings);
            await this.start(game);
            return { game, gameSettings };
        });

        const gamesCollections = await Promise.all(pArr);
        for (const gamesCollection of gamesCollections) {
            this.allGames[gamesCollection.gameSettings.channelId] = gamesCollection.game;
        }
    }
    async stopWaitingRoomsOnceGamesEnd(): Promise<void> {
        const pArr: Promise<void>[] = [];
        for (const game of Object.values(this.allGames)) {
            pArr.push(game.stopWaitingRoomOnceGameEnds());
        }
        await Promise.all(pArr);
    }
    /**
     * Start game waiting room
     * @param channel {TextChannel}
     */
    async start(game: Game): Promise<void> {
        game.waitingRoomChannel = this.client.channels.cache.get(
            game.settings.channelId
        ) as TextChannel;

        logger.info(
            `Channel ${game.settings.channelId} of type ${game.settings.gameType} has been started`
        );
        await game.sendWaitingRoomEmbed();
    }

    /**
     * Clicking the button will select the player's asset
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @Guard()
    @ButtonComponent({ id: waitingRoomInteractionIds.selectPlayer })
    async selectPlayer(interaction: ButtonInteraction): Promise<void> {
        await paginatedDarumaEmbed(interaction, this.allGames);
    }

    /**
     * Clicking the button will select the player's asset
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @Guard()
    @ButtonComponent({ id: /((daruma-select_)[^\s]*)\b/gm })
    async selectAsset(interaction: ButtonInteraction): Promise<void> {
        await registerPlayer(interaction, this.allGames);
    }
    /**
     * Clicking the button will withdraw the player's asset from the game
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @Guard()
    @ButtonComponent({ id: waitingRoomInteractionIds.withdrawPlayer })
    async withdrawPlayer(interaction: ButtonInteraction): Promise<void> {
        await withdrawPlayer(interaction, this.allGames);
    }
}
