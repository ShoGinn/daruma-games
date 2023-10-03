import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	CommandInteraction,
	EmbedBuilder,
	inlineCode,
	MessageActionRowComponentBuilder,
} from 'discord.js';
import { ButtonComponent, Discord, Guard, Slash, SlashGroup } from 'discordx';
import chunk from 'lodash/chunk.js';
import { randomInt } from 'node:crypto';
import { injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../entities/algo-nft-asset.entity.js';
import { AlgoWallet } from '../entities/algo-wallet.entity.js';
import { DarumaTrainingChannel } from '../entities/dt-channel.entity.js';
import { DarumaTrainingCacheKeys } from '../enums/daruma-training.js';
import {
	darumaGameDistributionsPerGameType,
	nftHoldersPieChart,
} from '../model/logic/quick-charts.js';
import { CustomCache } from '../services/custom-cache.js';
import {
	allDarumaStats,
	assetName,
	flexDaruma,
	paginatedDarumaEmbed,
} from '../utils/functions/dt-embeds.js';
import { getAssetUrl } from '../utils/functions/dt-images.js';
import {
	buildGameType,
	coolDownsDescending,
	karmaPayoutCalculator,
} from '../utils/functions/dt-utils.js';
import { InteractionUtils, ObjectUtil } from '../utils/utils.js';
@Discord()
@injectable()
@Category('Dojo')
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
	constructor(
		private orm: MikroORM,
		private cache: CustomCache,
	) {}
	@Slash({
		name: 'channel',
		description: 'Show the current channel settings',
	})
	@SlashGroup('dojo')
	async settings(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const em = this.orm.em.fork();

		// Get channel id from interaction
		const { channelId } = interaction;
		// Get channel settings from database
		const channelSettings = await em
			.getRepository(DarumaTrainingChannel)
			.getAllChannels();
		// Get channel settings for current channel
		const currentChannelSettings = channelSettings.find(
			(channel) => channel.id === channelId,
		);
		// If no settings found, return
		if (!currentChannelSettings) {
			await InteractionUtils.replyOrFollowUp(
				interaction,
				`This channel is not currently being tracked!`,
			);
			return;
		}
		if (!currentChannelSettings) {
			return;
		}
		const gameSettings = buildGameType(currentChannelSettings);
		const randomRound = randomInt(1, 25);
		const karmaPayoutNoZen = karmaPayoutCalculator(
			randomRound,
			gameSettings.token,
			false,
		);
		const karmaPayoutZen = karmaPayoutCalculator(
			randomRound,
			gameSettings.token,
			true,
		);
		const newEmbed = new EmbedBuilder();
		newEmbed.setTitle(`Channel Settings`);
		newEmbed.setDescription(`Current settings for this channel are:`);
		newEmbed.addFields(
			{
				name: `Game Type`,
				value: gameSettings.gameType,
				inline: true,
			},
			{
				name: 'Cooldown',
				value: ObjectUtil.timeToHuman(gameSettings.coolDown),
				inline: true,
			},
			{
				name: `\u200B`,
				value: `\u200B`,
			},
			{
				name: 'KARMA Payouts',
				value: '\u200B',
			},
			{
				name: 'Base Payout',
				value: gameSettings.token.baseAmount.toString(),
				inline: true,
			},
			{
				name: 'Achieving Zen multiplies the payout by ',
				value: gameSettings.token.zenMultiplier.toString(),
				inline: true,
			},
			{
				name: '\u200B',
				value: '\u200B',
				inline: true,
			},
			{
				name: 'Rounds 6+ Adds an additional',
				value: gameSettings.token.roundModifier.toString(),
				inline: true,
			},
			{
				name: 'Each round 6+ in Zen increases the multiplier by',
				value: gameSettings.token.zenRoundModifier.toString(),
				inline: true,
			},
			{
				name: '\u200B',
				value: 'Example Payouts',
			},
			{
				name: `Round ${randomRound} with Zen`,
				value: karmaPayoutZen.toString(),
				inline: true,
			},
			{
				name: `Round ${randomRound} without Zen`,
				value: karmaPayoutNoZen.toString(),
				inline: true,
			},
		);
		await InteractionUtils.replyOrFollowUp(interaction, {
			embeds: [newEmbed],
		});
	}
	@Slash({
		name: 'daruma',
		description: 'Setup your Daruma Customization',
	})
	@SlashGroup('dojo')
	async daruma(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		await paginatedDarumaEmbed(interaction);
	}
	@Slash({
		name: 'flex',
		description: 'Flex your Daruma Collection!',
	})
	async flex(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		await paginatedDarumaEmbed(interaction);
	}

	@Slash({
		name: 'ranking',
		description: 'Shows the top 20 ranking Daruma in the Dojos',
	})
	@SlashGroup('dojo')
	async dojoRanking(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const em = this.orm.em.fork();
		const algoExplorerURL = 'https://www.nftexplorer.app/asset/';
		// dtCacheKeys.TOTALGAMES is generated in the assetRankingByWinsTotalGames function
		const assetRankingWinsByTotalGames = await em
			.getRepository(AlgoNFTAsset)
			.assetRankingByWinsTotalGames();
		const winsRatio = assetRankingWinsByTotalGames.slice(0, 20);
		let winRatioString = '';
		for (const [index, element] of winsRatio.entries()) {
			if (!element) {
				continue;
			}
			const ownerWallet = await element.wallet?.load();
			const discordUserId = ownerWallet?.owner.id;
			const discordUser =
				interaction.client.users.cache
					.find((user) => user.id === discordUserId)
					?.toString() ?? '';

			const thisAssetName = assetName(element);
			const paddedIndex = (index + 1).toString().padStart(2, ' ');
			const wins = element.dojoWins.toString() ?? '0';
			const losses = element.dojoLosses.toString() ?? '0';
			const urlTitle = `${thisAssetName}\n${wins} wins\n${losses} losses`;
			const assetNameAndLink = `[***${thisAssetName}***](${algoExplorerURL}${element.id} "${urlTitle}")`;
			winRatioString += `${inlineCode(
				paddedIndex,
			)}. ${assetNameAndLink} - ${discordUser}\n`;
		}
		const newEmbed = new EmbedBuilder();
		const totalGames: number =
			this.cache.get(DarumaTrainingCacheKeys.TOTAL_GAMES) ?? 0;
		const timeRemaining = this.cache.humanTimeRemaining(
			DarumaTrainingCacheKeys.TOTAL_GAMES,
		);
		newEmbed.setTitle(`Top 20 Daruma Dojo Ranking`);
		newEmbed.setDescription(winRatioString);
		newEmbed.setThumbnail(await getAssetUrl(winsRatio[0]));
		newEmbed.setFooter({
			text: `Ranking is based on wins/total game rolls \nTotal Daruma Game Rolls ${totalGames.toLocaleString()}\nNext update ${timeRemaining}`,
		});
		const darumaEmbedButton =
			new ActionRowBuilder<MessageActionRowComponentBuilder>();
		darumaEmbedButton.addComponents(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Secondary)
				.setLabel('Detailed Info')
				.setCustomId('daruma-top20-stats'),
		);
		await InteractionUtils.replyOrFollowUp(interaction, {
			embeds: [newEmbed],
			components: [darumaEmbedButton],
		});
	}
	@Guard(RateLimit(TIME_UNIT.seconds, 20))
	@ButtonComponent({ id: /((daruma-flex)\S*)\b/gm })
	async selectPlayer(interaction: ButtonInteraction): Promise<void> {
		await flexDaruma(interaction);
	}
	@ButtonComponent({ id: 'daruma-all-stats' })
	async allMyDarumaStats(interaction: ButtonInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		await allDarumaStats(interaction);
	}
	@ButtonComponent({ id: 'daruma-top20-stats' })
	async top20DarumaStats(interaction: ButtonInteraction): Promise<void> {
		const em = this.orm.em.fork();
		const assetRankingWinsByTotalGames = await em
			.getRepository(AlgoNFTAsset)
			.assetRankingByWinsTotalGames();

		const winsRatio = assetRankingWinsByTotalGames.slice(0, 20);

		await paginatedDarumaEmbed(interaction, undefined, winsRatio);
	}
	@Slash({
		name: 'top20',
		description: 'Top Daruma Holders!',
	})
	async top20(interaction: CommandInteraction): Promise<void> {
		await this.topHolders(interaction);
	}
	@Slash({
		name: 'rounds_per_game_type',
		description: 'Rounds Per Game Type!',
	})
	@SlashGroup('dojo')
	async maxRoundsPerGameType(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const maxRoundsPerGameTypePieChartUrl =
			await darumaGameDistributionsPerGameType();
		const chartEmbed = [];
		for (const element of maxRoundsPerGameTypePieChartUrl) {
			chartEmbed.push(
				new EmbedBuilder()
					.setTitle(`Winning Rounds For ${element[0]}`)
					.setImage(element[1]),
			);
		}
		await InteractionUtils.replyOrFollowUp(interaction, {
			embeds: chartEmbed,
		});
	}
	@Slash({
		name: 'all_holders',
		description: 'All Daruma Holders!',
	})
	@SlashGroup('dojo')
	async allHoldersChart(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const em = this.orm.em.fork();
		const topNFTHolders = await em.getRepository(AlgoWallet).topNFTHolders();
		const topNFTHoldersPieChartUrl = nftHoldersPieChart(topNFTHolders);
		const chartEmbed = new EmbedBuilder()
			.setTitle('Daruma Holders')
			.setImage(topNFTHoldersPieChartUrl);
		await InteractionUtils.replyOrFollowUp(interaction, {
			embeds: [chartEmbed],
		});
	}

	@Slash({
		name: 'top20',
		description: 'Top Daruma Holders!',
	})
	@SlashGroup('dojo')
	async topHolders(interaction: CommandInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: false });
		// Use Custom Cache
		let rank: Array<string> | undefined = this.cache.get('topHolderRank');

		if (!rank) {
			const em = this.orm.em.fork();
			// Get top 20 players
			const topHolders = await em.getRepository(AlgoWallet).topNFTHolders();
			// reduce topPlayers to first 20
			const top20keys = [...topHolders.keys()].slice(0, 20);
			const top20values = [...topHolders.values()].slice(0, 20);
			rank = [];
			for (const [index, totalAsset] of top20values.entries()) {
				const discordUser = interaction.client.users.cache.find(
					(user) => user.id === top20keys[index],
				);
				if (!discordUser) {
					continue;
				}
				if (!totalAsset) {
					continue;
				}
				rank.push(
					`${inlineCode(
						totalAsset.toString().padStart(2, ' '),
					)} ${discordUser?.username}`,
				);
			}
			if (rank.length === 0) {
				rank.push('No one has a Daruma yet!');
			}
			this.cache.set('topHolderRank', rank, 600);
		}
		const ranks = rank.join('\n');

		const newEmbed = new EmbedBuilder();
		newEmbed.setTitle(`Top 20 Daruma Holders`);
		newEmbed.setDescription(ranks);
		// Set footer with time remaining
		const timeRemaining = this.cache.humanTimeRemaining(
			DarumaTrainingCacheKeys.TOP_NFT_HOLDERS,
		);
		newEmbed.setFooter({ text: `Next update ${timeRemaining}` });
		await InteractionUtils.replyOrFollowUp(interaction, { embeds: [newEmbed] });
	}
	@ButtonComponent({ id: 'showCoolDowns' })
	async coolDownButton(interaction: ButtonInteraction): Promise<void> {
		await this.cd(interaction);
	}
	@Slash({
		name: 'cd',
		description: 'Check your Cool downs!',
	})
	@SlashGroup('dojo')
	async dojoCd(interaction: CommandInteraction): Promise<void> {
		await this.cd(interaction);
	}
	@Slash({
		name: 'cd',
		description: 'Check your Cool downs!',
	})
	async cd(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
		await interaction.deferReply({ ephemeral: true });
		const caller = await InteractionUtils.getInteractionCaller(interaction);
		const coolDowns = await coolDownsDescending(caller);
		const pages: Array<string> = [];
		for (const coolDown of coolDowns) {
			const asset = assetName(coolDown);
			const coolDownTime = coolDown.dojoCoolDown;
			const coolDownTimeLeft = ObjectUtil.timeFromNow(coolDownTime.getTime());
			pages.push(`${asset} is ${coolDownTimeLeft}`);
		}
		if (coolDowns.length === 0) {
			await InteractionUtils.replyOrFollowUp(interaction, {
				content: 'You have no cool downs!',
			});
			return;
		}
		const embedsNeeded = Math.ceil(pages.join('\n').length / 4096);
		const chunkSize = Math.ceil(pages.length / embedsNeeded);

		const chunked = chunk(pages, chunkSize);
		const pages2 = chunked.map((page) => {
			return {
				embeds: [
					new EmbedBuilder()
						.setTitle('Cool Downs')
						.setDescription(page.join('\n')),
				],
			};
		});

		const pagination = new Pagination(
			interaction,
			pages2.map((embed) => embed),
			{
				type: PaginationType.Button,
				showStartEnd: false,
				onTimeout: () => {
					interaction.deleteReply().catch(() => null);
				},
				// 30 Seconds in ms
				time: 30_000,
			},
		);
		await pagination.send();
	}
}
