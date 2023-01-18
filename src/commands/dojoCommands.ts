import InteractionUtils = DiscordUtils.InteractionUtils;
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
import { ButtonComponent, Client, Discord, Guard, Slash, SlashGroup } from 'discordx';
import { randomInt } from 'node:crypto';
import { injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { DarumaTrainingChannel } from '../entities/DtChannel.js';
import { dtCacheKeys } from '../enums/dtEnums.js';
import { CustomCache } from '../services/CustomCache.js';
import {
    allDarumaStats,
    assetName,
    flexDaruma,
    paginatedDarumaEmbed,
} from '../utils/functions/dtEmbeds.js';
import { getAssetUrl } from '../utils/functions/dtImages.js';
import {
    buildGameType,
    coolDownsDescending,
    karmaPayoutCalculator,
} from '../utils/functions/dtUtils.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
@Discord()
@injectable()
@Category('Dojo')
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
    constructor(private orm: MikroORM, private client: Client, private cache: CustomCache) {}
    @Slash({
        name: 'channel',
        description: 'Show the current channel settings',
    })
    @SlashGroup('dojo')
    async settings(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();

        // Get channel id from interaction
        const channelId = interaction.channelId;
        // Get channel settings from database
        const channelSettings = await em.getRepository(DarumaTrainingChannel).getAllChannels();
        // Get channel settings for current channel
        const currentChannelSettings = channelSettings.find(channel => channel.id === channelId);
        // If no settings found, return
        if (!currentChannelSettings) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `This channel is not currently being tracked!`
            );
            return;
        }
        if (!currentChannelSettings) {
            return;
        }
        const gameSettings = buildGameType(currentChannelSettings);
        const randomRound = randomInt(1, 25);
        const karmaPayoutNoZen = karmaPayoutCalculator(randomRound, gameSettings.token, false);
        const karmaPayoutZen = karmaPayoutCalculator(randomRound, gameSettings.token, true);
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
                name: `\u200b`,
                value: `\u200b`,
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
                name: '\u200b',
                value: '\u200b',
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
            }
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
        const winsRatio = (
            await em.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames()
        ).slice(0, 20);
        let winRatioString = '';
        for (let index = 0; index < winsRatio.length; index++) {
            const element = winsRatio[index];
            const ownerWallet = await element.wallet.load();
            const discordUserId = ownerWallet.owner.id;
            const discordUser =
                interaction.client.users.cache.find(user => user.id === discordUserId) ?? '';

            const thisAssetName = assetName(element);
            const paddedIndex = (index + 1).toString().padStart(2, ' ');
            const wins = element.note?.dojoTraining?.wins.toString() ?? '0';
            const losses = element.note?.dojoTraining?.losses.toString() ?? '0';
            const urlTitle = `${thisAssetName}\n${wins} wins\n${losses} losses`;
            const assetNameAndLink = `[***${thisAssetName}***](${algoExplorerURL}${element.id} "${urlTitle}")`;
            winRatioString += `\`${paddedIndex}.\` ${assetNameAndLink} - ${discordUser}\n`;
        }
        const newEmbed = new EmbedBuilder();
        const totalGames: number = this.cache.get(dtCacheKeys.TOTALGAMES);
        const timeRemaining = ObjectUtil.timeFromNow(
            this.cache.timeRemaining(dtCacheKeys.TOTALGAMES)
        );
        newEmbed.setTitle(`Top 20 Daruma Dojo Ranking`);
        newEmbed.setDescription(winRatioString);
        newEmbed.setThumbnail(getAssetUrl(winsRatio[0]));
        newEmbed.setFooter({
            text: `Ranking is based on wins/total game rolls \nTotal Daruma Game Rolls ${totalGames.toLocaleString()}\nNext update ${timeRemaining}`,
        });
        const darumaEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
        darumaEmbedButton.addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel('Detailed Info')
                .setCustomId('daruma-top20-stats')
        );
        await InteractionUtils.replyOrFollowUp(interaction, {
            embeds: [newEmbed],
            components: [darumaEmbedButton],
        });
    }
    @Guard(RateLimit(TIME_UNIT.seconds, 20))
    @ButtonComponent({ id: /((daruma-flex)[^\s]*)\b/gm })
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
        const winsRatio = (
            await em.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames()
        ).slice(0, 20);

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
        name: 'top20',
        description: 'Top Daruma Holders!',
    })
    @SlashGroup('dojo')
    async topHolders(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: false });
        // Use Custom Cache
        let rank: Array<string> = this.cache.get(dtCacheKeys.TOPHOLDERRANK);

        if (!rank) {
            const em = this.orm.em.fork();
            // Get top 20 players
            const topHolders = await em.getRepository(AlgoWallet).topNFTHolders();
            // reduce topPlayers to first 20
            const top20keys = [...topHolders.keys()].slice(0, 20);
            const top20values = [...topHolders.values()].slice(0, 20);
            rank = [];
            for (let index = 0; index < top20values.length; index++) {
                const discordUser = interaction.client.users.cache.find(
                    user => user.id === top20keys[index]
                );
                if (!discordUser) continue;
                const totalAsset = top20values[index];
                rank.push(
                    `${inlineCode(totalAsset.toString().padStart(2, ' '))} ${discordUser?.username}`
                );
            }
            if (rank.length === 0) rank.push('No one has a Daruma yet!');
            this.cache.set(dtCacheKeys.TOPHOLDERRANK, rank, 60 * 10);
        }
        const ranks = rank.join('\n');

        const newEmbed = new EmbedBuilder();
        newEmbed.setTitle(`Top 20 Daruma Holders`);
        newEmbed.setDescription(ranks);
        // Set footer with time remaining
        const timeRemaining = ObjectUtil.timeFromNow(
            this.cache.timeRemaining(dtCacheKeys.TOPNFTHOLDERS)
        );
        newEmbed.setFooter({ text: `Next update ${timeRemaining}` });
        //newEmbed.setThumbnail(getAssetUrl(winsRatio[0]))
        await InteractionUtils.replyOrFollowUp(interaction, { embeds: [newEmbed] });
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
    async cd(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const coolDowns = await coolDownsDescending(caller);
        const pages: string[] = [];
        coolDowns.forEach(coolDown => {
            const asset = assetName(coolDown);
            const coolDownTime = coolDown.note?.coolDown || 0;
            const coolDownTimeLeft = ObjectUtil.timeFromNow(coolDownTime);
            pages.push(`${asset} is ${coolDownTimeLeft}`);
        });
        if (coolDowns.length === 0) {
            await InteractionUtils.replyOrFollowUp(interaction, {
                content: 'You have no cool downs!',
            });
            return;
        }
        const embedsNeeded = Math.ceil(pages.join('\n').length / 4096);
        const chunkSize = Math.ceil(pages.length / embedsNeeded);

        const chunked = ObjectUtil.chunkArray(pages, chunkSize);
        const pages2 = chunked.map(page => {
            return {
                embeds: [new EmbedBuilder().setTitle('Cool Downs').setDescription(page.join('\n'))],
            };
        });

        const pagination = new Pagination(
            interaction,
            pages2.map(embed => embed),
            {
                type: PaginationType.Button,
                showStartEnd: false,
                onTimeout: () => {
                    interaction.deleteReply().catch(() => null);
                },
                // 30 Seconds in ms
                time: 30 * 1000,
            }
        );
        await pagination.send();
    }
}
