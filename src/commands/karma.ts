import InteractionUtils = DiscordUtils.InteractionUtils;
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import {
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CommandInteraction,
    EmbedBuilder,
    GuildMember,
    inlineCode,
    MessageActionRowComponentBuilder,
} from 'discord.js';
import { Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';
import { injectable } from 'tsyringe';

import { AlgoStdAsset } from '../entities/AlgoStdAsset.js';
import { AlgoTxn } from '../entities/AlgoTxn.js';
import { User } from '../entities/User.js';
import { txnTypes } from '../enums/dtEnums.js';
import { Algorand } from '../services/Algorand.js';
import { Database } from '../services/Database.js';
import { yesNoButtons } from '../utils/functions/algoEmbeds.js';
import logger from '../utils/functions/LoggerFactory.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
@Discord()
@injectable()
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
export default class KarmaCommand {
    constructor(private algorand: Algorand, private db: Database) {}
    @Guard(PermissionGuard(['Administrator']))
    @Slash({
        description: 'Add Karma to a user',
        name: 'add',
    })
    @Category('Admin')
    @SlashGroup('karma')
    async add(
        @SlashOption({
            description: 'Discord User',
            name: 'username',
            required: true,
            type: ApplicationCommandOptionType.User,
        })
        username: GuildMember,
        @SlashOption({
            description: 'Amount To Add',
            name: 'amount',
            required: true,
            type: ApplicationCommandOptionType.Number,
        })
        amount: number,
        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        // ensure the amount is not negative
        if (amount < 0) {
            await InteractionUtils.replyOrFollowUp(interaction, 'You cannot add negative KARMA');
            return;
        }
        const user = await this.db.get(User).getUserById(caller.id);
        await this.db.get(User).addKarma(caller.id, amount);
        // Provide an audit log of who added karma and to who
        logger.warn(`${caller.user.username} added ${amount} KARMA to ${username.user.username}`);
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Added ${amount.toLocaleString()} KARMA to ${username} -- Now has ${user.karma.toLocaleString()} KARMA`
        );
    }
    @Category('Karma')
    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @Guard(RateLimit(TIME_UNIT.minutes, 2))
    async karmaClaim(interaction: CommandInteraction): Promise<void> {
        await this.claim(interaction);
    }

    @Category('Karma')
    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @SlashGroup('karma')
    @Guard(RateLimit(TIME_UNIT.minutes, 2))
    async claim(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const assetName = 'KARMA';
        const assetType = 'KRMA';
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const user = await this.db.get(User).getUserById(caller.id);
        const userAsset = user.karma;
        const rxWallet = await this.db.get(User).getRXWallet(caller.id);
        if (!rxWallet) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You do not have a wallet validated that can receive ${assetName}\n Add a wallet with ${inlineCode(
                    '/wallet add'
                )} that is OPTED IN to the ${assetName} token\n Check your wallet with ${inlineCode(
                    '/wallet list'
                )}`
            );
            return;
        }
        if (userAsset == 0) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You don't have any ${assetName} to claim!`
            );
            return;
        }
        let claimAsset: AlgoStdAsset;
        try {
            claimAsset = await this.db.get(AlgoStdAsset).getStdAssetByUnitName(assetType);
        } catch (_e) {
            logger.error(`Error getting ${assetType} Asset`);
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `Whoops tell the bot owner that the ${assetType} asset is not in the database`
            );
            return;
        }
        if (claimAsset) {
            let buttonRow = yesNoButtons('claim');
            const message = await interaction.followUp({
                components: [buttonRow],
                content: `__**Are you sure you want to claim ${userAsset.toLocaleString()} ${assetName}?**__\n _This will be sent to your designated wallet:_\n ${ObjectUtil.ellipseAddress(
                    rxWallet?.walletAddress
                )}`,
            });
            let claimEmbed = new EmbedBuilder();
            let claimEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
            claimEmbed.setTitle(`Claim ${assetName}`);
            claimEmbed.setDescription(`There was an error claiming your ${assetName}`);

            const collector = message.createMessageComponentCollector();
            collector.on('collect', async (collectInteraction: ButtonInteraction) => {
                await collectInteraction.deferUpdate();
                await collectInteraction.editReply({ components: [] });

                if (collectInteraction.customId.includes('yes')) {
                    await collectInteraction.editReply({
                        content: `Claiming ${userAsset.toLocaleString()} ${assetName}...`,
                    });
                    // Create claim response embed

                    await this.db.get(AlgoTxn).addPendingTxn(caller.id, userAsset);
                    let claimStatus = await this.algorand.claimToken(
                        claimAsset.assetIndex,
                        userAsset,
                        rxWallet.walletAddress
                    );
                    // Clear users asset balance
                    user.karma = 0;
                    await this.db.get(User).flush();
                    if (claimStatus.txId) {
                        logger.info(
                            `Claimed ${claimStatus.status?.txn.txn.aamt} ${assetName} for ${caller.user.username} (${caller.id})`
                        );
                        claimEmbed.setDescription(`Transaction Successful!`);
                        claimEmbed.addFields(
                            {
                                name: 'Txn ID',
                                value: claimStatus.txId,
                            },
                            {
                                name: 'Txn Hash',
                                value: claimStatus.status?.['confirmed-round'].toString(),
                            },
                            {
                                name: 'Transaction Amount',
                                value: claimStatus.status?.txn.txn.aamt.toLocaleString(),
                            }
                        );
                        // add button for algoexplorer
                        const algoExplorerButton = new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel('AlgoExplorer')
                            .setURL(`https://algoexplorer.io/tx/${claimStatus.txId}`);
                        claimEmbedButton.addComponents(algoExplorerButton);

                        await this.db.get(AlgoTxn).addTxn(caller.id, txnTypes.CLAIM, claimStatus);
                    }
                }
                if (collectInteraction.customId.includes('no')) {
                    claimEmbed.setDescription('No problem! Come back when you are ready!');
                }
                // check for button
                let embedButton: ActionRowBuilder<MessageActionRowComponentBuilder>[] | undefined[];
                if (claimEmbedButton.components.length > 0) {
                    embedButton = [claimEmbedButton];
                } else {
                    embedButton = [];
                }
                await collectInteraction.editReply({
                    content: '',
                    embeds: [claimEmbed],
                    components: embedButton,
                });

                collector.stop();
            });
        }
    }
}
