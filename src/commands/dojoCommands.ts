import InteractionUtils = DiscordUtils.InteractionUtils;
import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, EnumChoice, NotBot, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonInteraction,
    CommandInteraction,
    EmbedBuilder,
    MessageContextMenuCommandInteraction,
} from 'discord.js';
import {
    ButtonComponent,
    Client,
    ContextMenu,
    Discord,
    Guard,
    Slash,
    SlashChoice,
    SlashGroup,
    SlashOption,
} from 'discordx';
import { container, injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { DarumaTrainingChannel } from '../entities/DtChannel.js';
import { GameTypes } from '../enums/dtEnums.js';
import { BotOwnerOnly } from '../guards/BotOwnerOnly.js';
import { Ranking } from '../services/Ranking.js';
import { assetName, flexDaruma, paginatedDarumaEmbed } from '../utils/functions/dtEmbeds.js';
import { getAssetUrl } from '../utils/functions/dtImages.js';
import {
    buildGameType,
    coolDownsDescending,
    karmaPayoutCalculator,
    randomNumber,
} from '../utils/functions/dtUtils.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
import { DarumaTrainingManager } from './DarumaTraining.js';
@Discord()
@injectable()
@SlashGroup({ description: 'Dojo Commands', name: 'dojo' })
export default class DojoCommand {
    constructor(private orm: MikroORM, private client: Client, private ranking: Ranking) {}
    @Category('Admin')
    @Guard(BotOwnerOnly)
    @Slash({
        name: 'join',
        description: 'Have the bot join a dojo channel!',
    })
    async join(
        @SlashOption({
            description: 'Channel to join',
            name: 'channel',
            required: true,
            type: ApplicationCommandOptionType.Channel,
        })
        channelName: string,
        @SlashChoice(...EnumChoice(GameTypes))
        @SlashOption({
            description: 'Game type',
            name: 'game_type',
            required: true,
            type: ApplicationCommandOptionType.String,
        })
        channelType: GameTypes,
        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const waitingRoom = container.resolve(DarumaTrainingManager);
        const channelId = ObjectUtil.onlyDigits(channelName.toString());
        await em.getRepository(DarumaTrainingChannel).addChannel(channelId, channelType);
        waitingRoom.startWaitingRooms();
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Joined ${channelName}, with the default settings!`
        );
    }
    @Category('Admin')
    @Guard(BotOwnerOnly)
    @ContextMenu({
        name: 'Start Waiting Room',
        type: ApplicationCommandType.Message,
    })
    async startWaitingRoomAgain(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });

        const waitingRoom = container.resolve(DarumaTrainingManager);

        await InteractionUtils.replyOrFollowUp(interaction, 'Starting waiting room again...');
        waitingRoom.startWaitingRooms();
    }

    @Category('Admin')
    @Guard(BotOwnerOnly)
    @ContextMenu({ name: 'Leave Dojo', type: ApplicationCommandType.Message })
    async leave(interaction: MessageContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const message = await InteractionUtils.getMessageFromContextInteraction(interaction);
        const channelId = message.channelId;
        const channelName = `<#${message.channelId}>`;

        // Remove all but digits from channel name
        //const channelId = onlyDigits(channelName.toString())
        const channelMsgId = await em
            .getRepository(DarumaTrainingChannel)
            .getChannelMessageId(channelId);
        if (channelMsgId) {
            try {
                await interaction.channel?.messages.delete(channelMsgId);
            } catch (error) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,

                    `I couldn't delete the message!\nAttempting to leave the channel anyway...`
                );
            }
            const channelExists = await em
                .getRepository(DarumaTrainingChannel)
                .removeChannel(channelId);
            if (!channelExists) {
                await InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channelName}!`);
            } else {
                await InteractionUtils.replyOrFollowUp(interaction, `Left ${channelName}!`);
            }
        } else {
            await InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channelName}!`);
        }
    }

    @Category('Dojo')
    @Slash({
        name: 'channel',
        description: 'Show the current channel settings',
    })
    @SlashGroup('dojo')
    @Guard(NotBot)
    async settings(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();

        // Get channel id from interaction
        const channelId = interaction.channelId;
        // Get channel settings from database
        const channelSettings = await em.getRepository(DarumaTrainingChannel).getAllChannels();
        // Get channel settings for current channel
        const currentChannelSettings = channelSettings.find(
            channel => channel.channelId === channelId
        );
        // If no settings found, return
        if (!currentChannelSettings) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `This channel is not currently being tracked!`
            );
            return;
        }
        if (currentChannelSettings) {
            const gameSettings = buildGameType(currentChannelSettings);
            const randomRound = randomNumber(1, 25);
            const karmaPayoutNoZen = karmaPayoutCalculator(randomRound, gameSettings.token, false);
            const karmaPayoutZen = karmaPayoutCalculator(randomRound, gameSettings.token, true);
            let newEmbed = new EmbedBuilder();
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
    }
    @Category('Dojo')
    @Slash({
        name: 'daruma',
        description: 'Setup your Daruma Customization',
    })
    @SlashGroup('dojo')
    @Guard(NotBot)
    async daruma(interaction: CommandInteraction): Promise<void> {
        await paginatedDarumaEmbed(interaction);
    }
    @Category('Dojo')
    @Slash({
        name: 'flex',
        description: 'Setup your Daruma Customization',
    })
    @Guard(NotBot)
    async flex(interaction: CommandInteraction): Promise<void> {
        await paginatedDarumaEmbed(interaction);
    }

    @Category('Dojo')
    @Slash({
        name: 'ranking',
        description: 'Shows the top 20 ranking Daruma in the Dojos',
    })
    @SlashGroup('dojo')
    @Guard(NotBot)
    async dojoRanking(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const algoExplorerURL = 'https://www.nftexplorer.app/asset/';
        let winsRatio = await em.getRepository(AlgoNFTAsset).assetRankingByWinsTotalGames();
        // get the longest asset name length
        let winsRatioString = winsRatio
            .slice(0, 20)
            .map((asset, index) => {
                const thisAssetName = assetName(asset);
                const paddedIndex = (index + 1).toString().padStart(2, ' ');
                const wins = asset.assetNote?.dojoTraining?.wins.toString() ?? '0';
                const losses = asset.assetNote?.dojoTraining?.losses.toString() ?? '0';
                const urlTitle = `${thisAssetName}\n${wins} wins\n${losses} losses`;
                const assetNameAndLink = `[***${thisAssetName}***](${algoExplorerURL}${asset.assetIndex} "${urlTitle}")`;
                return `\`${paddedIndex}.\` ${assetNameAndLink}`;
            })
            .join('\n');
        let newEmbed = new EmbedBuilder();
        newEmbed.setTitle(`Top 20 Daruma Dojo Ranking`);
        newEmbed.setDescription(winsRatioString);
        newEmbed.setThumbnail(getAssetUrl(winsRatio[0]));
        newEmbed.setFooter({
            text: `Ranking is based on wins/total game rolls \nTotal Daruma Game Rolls ${this.ranking
                .get('totalGames')
                .toLocaleString()}\nStats updated every ~10 minutes`,
        });
        await InteractionUtils.replyOrFollowUp(interaction, { embeds: [newEmbed] });
    }
    @Guard()
    @Guard(RateLimit(TIME_UNIT.seconds, 20))
    @ButtonComponent({ id: /((daruma-flex)[^\s]*)\b/gm })
    async selectPlayer(interaction: ButtonInteraction): Promise<void> {
        await flexDaruma(interaction);
    }
    @Category('Dojo')
    @Slash({
        name: 'top20',
        description: 'Top Daruma Holders!',
    })
    @Guard(NotBot)
    @SlashGroup('dojo')
    async topPlayers(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        // Get top 20 players
        const topPlayers = await em.getRepository(AlgoWallet).getTopPlayers();
        // reduce topPlayers to first 20
        let top20keys = [...topPlayers.keys()].slice(0, 20);
        let top20values = [...topPlayers.values()].slice(0, 20);
        let rank = [];
        for (let index = 0; index < top20values.length; index++) {
            const discordUser = top20keys[index];
            const totalAsset = top20values[index];
            rank.push(`\`${totalAsset.toString().padStart(2, ' ')}\` <@${discordUser}>`);
        }
        let ranks = rank.join('\n');
        let newEmbed = new EmbedBuilder();
        newEmbed.setTitle(`Top 20 Daruma Holders`);
        newEmbed.setDescription(ranks);
        //newEmbed.setThumbnail(getAssetUrl(winsRatio[0]))
        await InteractionUtils.replyOrFollowUp(interaction, { embeds: [newEmbed] });
    }

    @Category('Dojo')
    @Slash({
        name: 'cd',
        description: 'Check your Cool downs!',
    })
    @Guard(NotBot)
    @SlashGroup('dojo')
    async dojoCd(interaction: CommandInteraction): Promise<void> {
        await this.cd(interaction);
    }
    @Category('Dojo')
    @Slash({
        name: 'cd',
        description: 'Shortcut -- Check your Cool downs!',
    })
    @Guard(NotBot)
    async cd(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const em = this.orm.em.fork();
        let playableAssets = await em.getRepository(AlgoWallet).getPlayableAssets(caller.id);
        let coolDowns = coolDownsDescending(playableAssets);
        let pages: string[] = [];
        coolDowns.forEach(coolDown => {
            let asset = assetName(coolDown);
            let coolDownTime = coolDown.assetNote?.coolDown || 0;
            let coolDownTimeLeft = ObjectUtil.timeFromNow(coolDownTime);
            pages.push(`${asset} is ${coolDownTimeLeft}`);
        });
        if (coolDowns.length === 0) {
            await InteractionUtils.replyOrFollowUp(interaction, {
                content: 'You have no cool downs!',
            });
            return;
        }
        const chunked = ObjectUtil.chunkArray(pages, 20);
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
