import { Loaded, MikroORM } from '@mikro-orm/core';
import {
    ButtonInteraction,
    DiscordAPIError,
    GuildChannel,
    TextBasedChannel,
    TextChannel,
} from 'discord.js';
import { ButtonComponent, Client, Discord } from 'discordx';
import { injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannel } from '../entities/DtChannel.entity.js';
import { waitingRoomInteractionIds } from '../enums/dtEnums.js';
import { Game } from '../utils/classes/dtGame.js';
import {
    paginatedDarumaEmbed,
    quickJoinDaruma,
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
        const gameChannels = await this.getAllChannelsInDB();
        const pArr = gameChannels.map(async channelSettings => {
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
    async startWaitingRoomForChannel(channel: TextBasedChannel | GuildChannel): Promise<void> {
        gatherEmojis(this.client);
        const gameChannel = await this.getChannelFromDB(channel);
        if (!gameChannel) return;
        const gameSettings = buildGameType(gameChannel);
        const game = new Game(gameSettings);
        await this.start(game);
        this.allGames[channel.id] = game;
    }
    async getAllChannelsInDB(): Promise<Loaded<DarumaTrainingChannel, never>[]> {
        const em = this.orm.em.fork();
        // iterate over the guilds in the client and get the channels
        const guilds = this.client.guilds.cache;
        // fetch the channels based upon the guild with a map
        const channels = await Promise.all(
            Array.from(guilds.values()).map(guild =>
                em.getRepository(DarumaTrainingChannel).getAllChannelsInGuild(guild.id)
            )
        );
        return channels.flatMap(channel => channel);
    }
    async getChannelFromDB(
        channel: TextBasedChannel | GuildChannel
    ): Promise<Loaded<DarumaTrainingChannel, never>> {
        const em = this.orm.em.fork();
        return await em.getRepository(DarumaTrainingChannel).getChannel(channel);
    }

    async stopWaitingRoomsOnceGamesEnd(): Promise<void> {
        const pArr: Array<Promise<void>> = [];
        for (const game of Object.values(this.allGames)) {
            pArr.push(game.stopWaitingRoomOnceGameEnds());
        }
        await Promise.all(pArr);
    }
    /**
     * Start game waiting room
     * @param channel {TextBaseChannel}
     */
    async start(game: Game): Promise<void> {
        const channel = (await this.client.channels.fetch(game.settings.channelId)) as TextChannel;
        if (!channel || !(channel instanceof TextChannel)) {
            throw new Error(`Could not find TextChannel ${game.settings.channelId}`);
        }
        game.waitingRoomChannel = channel;
        logger.info(
            `Channel ${game.waitingRoomChannel.name} (${game.waitingRoomChannel.id}) of type ${game.settings.gameType} has been started`
        );
        await game.sendWaitingRoomEmbed();
    }
    async respondWhenGameDoesNotExist(interaction: ButtonInteraction): Promise<boolean> {
        // Check if the channel exists
        if (!this.allGames[interaction.channelId]) {
            // Tag the dev and send a message to the channel
            const dev = process.env.BOT_OWNER_ID;
            // return a response
            const response = `The game in ${interaction.channel} does not exist. Please contact <@${dev}> to resolve this issue.`;
            // send the response
            await interaction.reply(response);
            // attempt to delete the interaction
            try {
                await interaction.deleteReply();
            } catch (error) {
                logger.error(error);
            }
            return true;
        }
        return false;
    }
    /**
     * Clicking the button registers the player to the game
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @ButtonComponent({ id: waitingRoomInteractionIds.registerPlayer })
    async registerPlayer(interaction: ButtonInteraction): Promise<void> {
        try {
            if (await this.respondWhenGameDoesNotExist(interaction)) return;
            await interaction.deferReply({ ephemeral: true });
            await paginatedDarumaEmbed(interaction, this.allGames);
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                // if the error is DiscordAPIError[10062]: Unknown interaction skip it otherwise log it
                if (error.code !== 10062) {
                    logger.error(error);
                }
            }
        }
    }
    /**
     * Clicking the button selects the first available daruma and enters the player into the game
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @ButtonComponent({ id: waitingRoomInteractionIds.quickJoin })
    async quickJoin(interaction: ButtonInteraction): Promise<void> {
        try {
            if (await this.respondWhenGameDoesNotExist(interaction)) return;

            await interaction.deferReply({ ephemeral: true });
            await quickJoinDaruma(interaction, this.allGames);
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                // if the error is DiscordAPIError[10062]: Unknown interaction skip it otherwise log it
                if (error.code !== 10062) {
                    logger.error(error);
                }
            }
        }
    }

    /**
     * Clicking the button will select the player's asset
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @ButtonComponent({ id: /((daruma-select_)[^\s]*)\b/gm })
    async selectAsset(interaction: ButtonInteraction): Promise<void> {
        try {
            if (await this.respondWhenGameDoesNotExist(interaction)) return;

            await interaction.deferReply({ ephemeral: true });
            await registerPlayer(interaction, this.allGames);
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                // if the error is DiscordAPIError[10062]: Unknown interaction skip it otherwise log it
                if (error.code !== 10062) {
                    logger.error(error);
                }
            }
        }
    }
    /**
     * Clicking the button will withdraw the player's asset from the game
     *
     * @param {ButtonInteraction} interaction
     * @memberof DarumaTrainingManager
     */
    @ButtonComponent({ id: waitingRoomInteractionIds.withdrawPlayer })
    async withdrawPlayer(interaction: ButtonInteraction): Promise<void> {
        if (await this.respondWhenGameDoesNotExist(interaction)) return;

        await interaction.deferReply({ ephemeral: true });
        await withdrawPlayer(interaction, this.allGames);
    }
}
