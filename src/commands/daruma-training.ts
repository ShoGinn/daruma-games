import { Loaded, MikroORM } from '@mikro-orm/core';
import {
	ButtonInteraction,
	GuildChannel,
	TextBasedChannel,
	TextChannel,
} from 'discord.js';
import { ButtonComponent, Client, Discord } from 'discordx';
import { injectable, singleton } from 'tsyringe';

import { DarumaTrainingChannel } from '../entities/dt-channel.entity.js';
import { WaitingRoomInteractionIds } from '../enums/daruma-training.js';
import { withCustomDiscordApiErrorLogger } from '../model/framework/decorators/discord-error-handler.js';
import { Game } from '../utils/classes/dt-game.js';
import {
	paginatedDarumaEmbed,
	quickJoinDaruma,
	registerPlayer,
	withdrawPlayer,
} from '../utils/functions/dt-embeds.js';
import { buildGameType } from '../utils/functions/dt-utils.js';
import logger from '../utils/functions/logger-factory.js';
import { getDeveloperMentions } from '../utils/utils.js';

@Discord()
@injectable()
@singleton()
export class DarumaTrainingManager {
	constructor(
		private client: Client,
		private orm: MikroORM,
	) {}
	public allGames: Record<string, Game> = {};

	async startGamesForChannels(
		channelSettings: Loaded<DarumaTrainingChannel, never>[],
	): Promise<void> {
		const pArray = channelSettings.map(async (channelSetting) => {
			const gameSettings = buildGameType(channelSetting);
			const game = new Game(gameSettings);
			await this.start(game);
			return { game, gameSettings };
		});
		const gamesCollections = await Promise.all(pArray);
		for (const gamesCollection of gamesCollections) {
			if (!gamesCollection) {
				continue;
			}
			this.allGames[gamesCollection.gameSettings.channelId] =
				gamesCollection.game;
		}
	}
	async startWaitingRooms(): Promise<void> {
		const gameChannels = await this.getAllChannelsInDB();
		await this.startGamesForChannels(gameChannels);
	}
	async startWaitingRoomForChannel(
		channel: TextBasedChannel | GuildChannel,
	): Promise<boolean> {
		try {
			const gameChannel = await this.getChannelFromDB(channel);
			if (!gameChannel) {
				return false;
			}
			await this.startGamesForChannels([gameChannel]);
			return true;
		} catch (error) {
			logger.error('Could not start the waiting room because:', error);
			return false;
		}
	}
	async getAllChannelsInDB(): Promise<Loaded<DarumaTrainingChannel, never>[]> {
		const em = this.orm.em.fork();
		// iterate over the guilds in the client and get the channels
		const guilds = this.client.guilds.cache;
		// fetch the channels based upon the guild with a map
		const channels = await Promise.all(
			[...guilds.values()].map((guild) =>
				em.getRepository(DarumaTrainingChannel).getAllChannelsInGuild(guild.id),
			),
		);
		return channels.flat();
	}
	async getChannelFromDB(
		channel: TextBasedChannel | GuildChannel,
	): Promise<Loaded<DarumaTrainingChannel, never>> {
		const em = this.orm.em.fork();
		return await em.getRepository(DarumaTrainingChannel).getChannel(channel);
	}
	async removeChannelFromDB(channelId: string): Promise<boolean> {
		const em = this.orm.em.fork();
		const channel = await em
			.getRepository(DarumaTrainingChannel)
			.findOne({ id: channelId });
		if (!channel) {
			return false;
		}
		await em.removeAndFlush(channel);
		return true;
	}
	async stopWaitingRoomsOnceGamesEnd(): Promise<void> {
		const pArray: Array<Promise<void>> = [];
		for (const game of Object.values(this.allGames)) {
			pArray.push(game.stopWaitingRoomOnceGameEnds());
		}
		await Promise.all(pArray);
	}
	/**
	 * Start the Game
	 *
	 * @param {Game} game
	 * @returns {*}  {Promise<boolean>}
	 * @memberof DarumaTrainingManager
	 */
	async start(game: Game): Promise<boolean> {
		let channel: TextChannel;
		try {
			channel = (await this.client.channels.fetch(
				game.settings.channelId,
			)) as TextChannel;
		} catch {
			logger.error(
				`Could not find channel ${game.settings.channelId} -- Removing from DB`,
			);
			return await this.removeChannelFromDB(game.settings.channelId);
		}
		if (!channel || !(channel instanceof TextChannel)) {
			throw new Error(`Could not find TextChannel ${game.settings.channelId}`);
		}
		game.waitingRoomChannel = channel;
		logger.info(
			`Channel ${game.waitingRoomChannel.name} (${game.waitingRoomChannel.id}) of type ${game.settings.gameType} has been started`,
		);
		await game.sendWaitingRoomEmbed(true, true);
		return true;
	}
	async respondWhenGameDoesNotExist(
		interaction: ButtonInteraction,
	): Promise<boolean> {
		// Check if the channel exists
		if (!this.allGames[interaction.channelId]) {
			const channel = interaction.channel?.toString() ?? 'this channel';
			const response = `The game in ${channel} does not exist. Please contact ${getDeveloperMentions()} to resolve this issue.`;
			// send the response
			await interaction.reply(response);
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
	@ButtonComponent({ id: WaitingRoomInteractionIds.registerPlayer })
	@withCustomDiscordApiErrorLogger
	async registerPlayer(interaction: ButtonInteraction): Promise<void> {
		if (await this.respondWhenGameDoesNotExist(interaction)) {
			return;
		}
		await interaction.deferReply({ ephemeral: true });
		await paginatedDarumaEmbed(interaction, this.allGames);
	}
	/**
	 * Clicking the button selects the first available daruma and enters the player into the game
	 *
	 * @param {ButtonInteraction} interaction
	 * @memberof DarumaTrainingManager
	 */
	@ButtonComponent({ id: WaitingRoomInteractionIds.quickJoin })
	@withCustomDiscordApiErrorLogger
	async quickJoin(interaction: ButtonInteraction): Promise<void> {
		if (await this.respondWhenGameDoesNotExist(interaction)) {
			return;
		}

		await interaction.deferReply({ ephemeral: true });
		await quickJoinDaruma(interaction, this.allGames);
	}

	/**
	 * Clicking the button will select the player's asset
	 *
	 * @param {ButtonInteraction} interaction
	 * @memberof DarumaTrainingManager
	 */
	@ButtonComponent({ id: /((daruma-select_)\S*)\b/gm })
	@withCustomDiscordApiErrorLogger
	async selectAsset(interaction: ButtonInteraction): Promise<void> {
		if (await this.respondWhenGameDoesNotExist(interaction)) {
			return;
		}

		await interaction.deferReply({ ephemeral: true });
		await registerPlayer(interaction, this.allGames);
	}
	/**
	 * Clicking the button will withdraw the player's asset from the game
	 *
	 * @param {ButtonInteraction} interaction
	 * @memberof DarumaTrainingManager
	 */
	@ButtonComponent({ id: WaitingRoomInteractionIds.withdrawPlayer })
	async withdrawPlayer(interaction: ButtonInteraction): Promise<void> {
		if (await this.respondWhenGameDoesNotExist(interaction)) {
			return;
		}

		await interaction.deferReply({ ephemeral: true });
		await withdrawPlayer(interaction, this.allGames);
	}
}
