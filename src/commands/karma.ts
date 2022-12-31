import InteractionUtils = DiscordUtils.InteractionUtils;
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
    ActionRowBuilder,
    APIEmbedField,
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
import { AlgoStdToken } from '../entities/AlgoStdToken.js';
import { AlgoTxn } from '../entities/AlgoTxn.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { User } from '../entities/User.js';
import { optimizedImages, txnTypes } from '../enums/dtEnums.js';
import { FutureFeature } from '../guards/FutureFeature.js';
import { Algorand } from '../services/Algorand.js';
import { yesNoButtons } from '../utils/functions/algoEmbeds.js';
import { emojiConvert } from '../utils/functions/dtEmojis.js';
import { optimizedImageHostedUrl } from '../utils/functions/dtImages.js';
import logger from '../utils/functions/LoggerFactory.js';
import {
    karmaArtifactWebhook,
    karmaClaimWebhook,
    karmaTipWebHook,
} from '../utils/functions/WebHooks.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
@Discord()
@injectable()
@Category('Karma')
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
@SlashGroup({ description: 'Admin Commands', name: 'admin' })
export default class KarmaCommand {
    constructor(private algorand: Algorand, private orm: MikroORM) {}
    private assetName = 'KARMA';
    private assetType = 'KRMA';
    // Setup the number of artifacts necessary to reach enlightenment
    private necessaryArtifacts = 4; // two arms and two legs
    private artifactCost = 1000; // 1000 KRMA per artifact

    /**
     * Administrator Command to add KARMA to a user
     *
     * @param {GuildMember} karmaAddUser
     * @param {number} amount
     * @param {CommandInteraction} interaction
     * @returns {*}  {Promise<void>}
     * @memberof KarmaCommand
     */
    @Guard(PermissionGuard(['Administrator']))
    @Slash({
        description: 'Add Karma to a user',
        name: 'add_karma',
    })
    @Category('Admin')
    @SlashGroup('admin')
    async add(
        @SlashOption({
            description: 'Discord User',
            name: 'username',
            required: true,
            type: ApplicationCommandOptionType.User,
        })
        karmaAddUser: GuildMember,
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
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You cannot add negative ${this.assetName}`
            );
            return;
        }
        const em = this.orm.em.fork();
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        const algoStdTokenDb = em.getRepository(AlgoStdToken);

        const karmaAsset = await algoStdAsset.getStdAssetByUnitName(this.assetType);
        let newTokens = 0;
        const walletWithMostTokens = await em
            .getRepository(AlgoWallet)
            .getWalletWithGreatestTokens(karmaAddUser.id, this.assetType);
        if (walletWithMostTokens) {
            newTokens = await algoStdTokenDb.addUnclaimedTokens(
                walletWithMostTokens,
                karmaAsset.assetIndex,
                amount
            );
        } else {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `User ${karmaAddUser} does not have a wallet to add ${this.assetName} to`
            );
            return;
        }

        // Provide an audit log of who added karma and to who
        logger.warn(
            `${caller.user.username} added ${amount} ${this.assetName} to ${karmaAddUser.user.username}`
        );
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Added ${amount.toLocaleString()} ${
                this.assetName
            } to ${karmaAddUser} -- Now has ${newTokens.toLocaleString()} ${this.assetName}`
        );
    }

    /**
     * This is the TIP command
     *
     * @param {GuildMember} tipUser
     * @param {number} karmaAmount
     * @param {CommandInteraction} interaction
     * @returns {*}  {Promise<void>}
     * @memberof KarmaCommand
     */
    @Slash({
        name: 'tip',
        description: 'Tip Someone some KARMA -- So Kind of You!',
    })
    @SlashGroup('karma')
    @Guard(RateLimit(TIME_UNIT.minutes, 1))
    async tip(
        @SlashOption({
            description: 'Who To Tip?',
            name: 'username',
            required: true,
            type: ApplicationCommandOptionType.User,
        })
        tipUser: GuildMember,
        @SlashOption({
            description: 'How Much are you Tipping? (Bot uses the wallet with the most KARMA)',
            name: 'amount',
            required: true,
            type: ApplicationCommandOptionType.Number,
        })
        karmaAmount: number,
        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: false });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        // get the caller's wallet

        const em = this.orm.em.fork();
        const callerRxWallet = await em
            .getRepository(AlgoWallet)
            .getWalletWithGreatestTokens(caller.id, this.assetType);

        try {
            const user = await em.getRepository(User).getUserById(tipUser.id);
            // Ensure the user is not tipping themselves
            if (tipUser.id === caller.id) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,
                    `You cannot tip yourself ${this.assetName}`
                );
                return;
            }
            // Ensure the user is not tipping a bot
            if (tipUser.user.bot) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,
                    `You cannot tip a bot ${this.assetName}`
                );
                return;
            }
            // Check if the user has a RX wallet
            const tipUserRxWallet = await em
                .getRepository(AlgoWallet)
                .getWalletWithGreatestTokens(user.id, this.assetType);
            if (!tipUserRxWallet) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,
                    `The User you are attempting to Tip does not have a wallet that can receive ${
                        this.assetName
                    }\nHave them check ${inlineCode(
                        '/wallet'
                    )} and ensure they have opted into the ${this.assetName} token.`
                );
                return;
            }
            let tipAsset = await this.checkStdAsset(interaction);
            if (tipAsset) {
                // Build the embed to show that the tip is being processed
                let tipAssetEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
                let tipAssetEmbed = new EmbedBuilder()
                    .setTitle(`Tip ${this.assetName}`)
                    .setDescription(
                        `Processing Tip of ${karmaAmount.toLocaleString()} ${
                            this.assetName
                        } to ${tipUser}...`
                    )
                    .setAuthor({ name: caller.user.username, iconURL: caller.user.avatarURL() })
                    .setTimestamp();
                await InteractionUtils.replyOrFollowUp(interaction, {
                    embeds: [tipAssetEmbed],
                });
                await em.getRepository(AlgoTxn).addPendingTxn(caller.id, karmaAmount);
                // Send the tip
                const tipTxn = await this.algorand.tipToken(
                    tipAsset.assetIndex,
                    karmaAmount,
                    tipUserRxWallet.walletAddress,
                    callerRxWallet.walletAddress
                );
                if (tipTxn.txId) {
                    logger.info(
                        `Tipped ${tipTxn.status?.txn.txn.aamt} ${this.assetName} from ${caller.user.username} (${caller.id}) to ${tipUser.user.username} (${tipUser.id})`
                    );
                    tipAssetEmbed.setDescription(
                        `Tipped ${tipTxn.status?.txn.txn.aamt.toLocaleString()} ${
                            this.assetName
                        } to ${tipUser}`
                    );
                    tipAssetEmbed.addFields(
                        {
                            name: 'Txn ID',
                            value: tipTxn.txId,
                        },
                        {
                            name: 'Txn Hash',
                            value: tipTxn.status?.['confirmed-round'].toString(),
                        },
                        {
                            name: 'Transaction Amount',
                            value: tipTxn.status?.txn.txn.aamt.toLocaleString(),
                        }
                    );
                    // add button for algoexplorer
                    const algoExplorerButton = new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel('AlgoExplorer')
                        .setURL(`https://algoexplorer.io/tx/${tipTxn.txId}`);
                    tipAssetEmbedButton.addComponents(algoExplorerButton);
                    await em.getRepository(AlgoTxn).addTxn(caller.id, txnTypes.TIP, tipTxn);
                    await em.getRepository(User).syncUserWallets(caller.id);
                    karmaTipWebHook(
                        caller,
                        tipUser,
                        tipTxn.status?.txn.txn.aamt.toLocaleString(),
                        `https://algoexplorer.io/tx/${tipTxn.txId}`
                    );
                } else {
                    tipAssetEmbed.setDescription(
                        `There was an error sending the ${this.assetName} to ${tipUser}`
                    );
                    tipAssetEmbed.addFields({
                        name: 'Error',
                        value: JSON.stringify(tipTxn),
                    });
                }
                let embedButton: ActionRowBuilder<MessageActionRowComponentBuilder>[] | undefined[];
                if (tipAssetEmbedButton.components.length > 0) {
                    embedButton = [tipAssetEmbedButton];
                } else {
                    embedButton = [];
                }
                await interaction.editReply({
                    embeds: [tipAssetEmbed],
                    components: embedButton,
                });
            }
        } catch (error) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `The User ${tipUser} you are attempting to tip cannot receive ${this.assetName} because they have not registered.`
            );
            return;
        }
    }

    /**
     * Claim your KARMA
     *
     * @param {CommandInteraction} interaction
     * @returns {*}  {Promise<void>}
     * @memberof KarmaCommand
     */
    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @Guard(RateLimit(TIME_UNIT.minutes, 2))
    async karmaClaim(interaction: CommandInteraction): Promise<void> {
        await this.claim(interaction);
    }

    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @SlashGroup('karma')
    @Guard(RateLimit(TIME_UNIT.minutes, 2))
    async claim(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const em = this.orm.em.fork();
        const userDb = em.getRepository(User);
        const algoWalletDb = em.getRepository(AlgoWallet);
        const algoTxn = em.getRepository(AlgoTxn);
        const algoStdToken = em.getRepository(AlgoStdToken);
        const algoStdAsset = em.getRepository(AlgoStdAsset);
        const allWalletsOptedIn = await algoWalletDb.getAllWalletsOptedInToToken(
            caller.id,
            this.assetType
        );
        const karmaAsset = await algoStdAsset.getStdAssetByUnitName(this.assetType);

        // filter out any opted in wallet that does not have unclaimed KARMA
        let walletsWithUnclaimedKarma: AlgoWallet[] = [];
        // make tuple with wallet and unclaimed tokens
        let walletsWithUnclaimedKarmaTuple: [AlgoWallet, number][] = [];
        for (const wallet of allWalletsOptedIn) {
            const unclaimedKarma = await algoStdToken.checkIfWalletHasAssetWithUnclaimedTokens(
                wallet,
                karmaAsset.assetIndex
            );
            if (unclaimedKarma.unclaimedTokens > 0) {
                walletsWithUnclaimedKarma.push(wallet);
                walletsWithUnclaimedKarmaTuple.push([wallet, unclaimedKarma.unclaimedTokens]);
            }
        }
        if (!allWalletsOptedIn) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You do not have a wallet validated that can receive ${
                    this.assetName
                }\nCheck your wallets with the command ${inlineCode(
                    '/wallet'
                )} and ensure you have OPTED into the ${this.assetName} token.`
            );
            return;
        }
        let walletsWithUnclaimedKarmaStr = '';

        if (!walletsWithUnclaimedKarma) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You don't have any ${this.assetName} to claim!`
            );
            return;
        } else {
            // build string of wallets with unclaimed KARMA
            for (const wallet of walletsWithUnclaimedKarmaTuple) {
                walletsWithUnclaimedKarmaStr += `${ObjectUtil.ellipseAddress(
                    wallet[0].walletAddress
                )} - ${wallet[1].toLocaleString()} ${this.assetName}`;
            }
        }

        let claimAsset = await this.checkStdAsset(interaction);
        if (claimAsset) {
            let buttonRow = yesNoButtons('claim');
            const message = await interaction.followUp({
                components: [buttonRow],
                content: `__**Are you sure you want to claim ${this.assetName}?**__\n You have ${walletsWithUnclaimedKarma.length} wallet(s) with KARMA\n ${walletsWithUnclaimedKarmaStr}`,
            });
            let claimEmbed = new EmbedBuilder();
            let claimEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
            claimEmbed.setTitle(`Claim ${this.assetName}`);
            let claimEmbedFields = [];
            let claimEmbedButtons = [];
            const collector = message.createMessageComponentCollector();
            collector.on('collect', async (collectInteraction: ButtonInteraction) => {
                await collectInteraction.deferUpdate();
                await collectInteraction.editReply({ components: [] });

                if (collectInteraction.customId.includes('yes')) {
                    await collectInteraction.editReply({
                        content: `Claiming ${this.assetName}...`,
                    });
                    // Create claim response embed looping through wallets with unclaimed KARMA
                    for (const wallet of walletsWithUnclaimedKarmaTuple) {
                        await algoTxn.addPendingTxn(caller.id, wallet[1]);
                        let claimStatus = await this.algorand.claimToken(
                            claimAsset.assetIndex,
                            wallet[1],
                            wallet[0].walletAddress
                        );
                        // Clear users asset balance
                        await algoStdToken.zeroOutUnclaimedTokens(wallet[0], claimAsset.assetIndex);
                        if (claimStatus.txId) {
                            logger.info(
                                `Claimed ${claimStatus.status?.txn.txn.aamt} ${this.assetName} for ${caller.user.username} (${caller.id})`
                            );
                            claimEmbedFields.push(
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
                            claimEmbedButtons.push(
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Link)
                                    .setLabel(`AlgoExplorer`)
                                    .setURL(`https://algoexplorer.io/tx/${claimStatus.txId}`)
                            );
                            await algoTxn.addTxn(caller.id, txnTypes.CLAIM, claimStatus);
                            karmaClaimWebhook(
                                caller,
                                claimStatus.status?.txn.txn.aamt.toLocaleString(),
                                `https://algoexplorer.io/tx/${claimStatus.txId}`
                            );
                        } else {
                            claimEmbedFields.push({
                                name: 'Error',
                                value: JSON.stringify(claimStatus),
                            });
                        }
                        claimEmbed.addFields(claimEmbedFields);
                        claimEmbedButton.addComponents(claimEmbedButtons);
                    }
                    await userDb.syncUserWallets(caller.id);
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

    /**
     * This is the Karma Shop
     *
     * @param {CommandInteraction} interaction
     * @returns {*}  {Promise<void>}
     * @memberof KarmaCommand
     */
    @Slash({
        description: 'Shop at the Karma Store',
        name: 'shop',
    })
    @SlashGroup('karma')
    @Guard(FutureFeature)
    async shop(interaction: CommandInteraction): Promise<void> {
        const caller = InteractionUtils.getInteractionCaller(interaction);

        await interaction.deferReply({ ephemeral: true });

        // Get the shop embed
        let { shopEmbed, shopButtonRow } = await this.shopEmbed(caller.id);
        const message = await interaction.followUp({
            embeds: [shopEmbed],
            components: [shopButtonRow],
        });
        // Create the collector
        const collector = message.createMessageComponentCollector();
        collector.on('collect', async (collectInteraction: ButtonInteraction) => {
            await collectInteraction.deferUpdate();
            // Set the purchase embed to the shop embed
            let purchaseEmbed = shopEmbed;
            // Change the footer to say please wait and remove the buttons and fields
            purchaseEmbed.setColor('Gold');
            purchaseEmbed.spliceFields(0, 25);
            purchaseEmbed.setFooter({ text: 'Please wait...' });
            await collectInteraction.editReply({ embeds: [purchaseEmbed], components: [] });

            let claimStatus: AlgorandPlugin.ClaimTokenResponse;

            switch (collectInteraction.customId) {
                case 'buyArtifact':
                    // subtract the cost from the users wallet
                    purchaseEmbed.setDescription('Buying an artifact...');
                    await collectInteraction.editReply({ embeds: [purchaseEmbed], components: [] });

                    // Clawback the tokens and purchase the artifact
                    claimStatus = await this.claimArtifact(collectInteraction, caller);

                    if (claimStatus.txId) {
                        purchaseEmbed.setImage(optimizedImageHostedUrl(optimizedImages.ARTIFACT));
                        purchaseEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Artifact', 'Claimed!')
                        );
                        purchaseEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.txId)
                        );
                    } else {
                        purchaseEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Artifact', 'Error!')
                        );
                    }
                    break;
                case 'buyEnlightenment':
                    // subtract the cost from the users wallet
                    purchaseEmbed.setDescription('Buying enlightenment...');
                    await collectInteraction.editReply({ embeds: [purchaseEmbed], components: [] });
                    purchaseEmbed.setImage(optimizedImageHostedUrl(optimizedImages.ENLIGHTENMENT));
                    purchaseEmbed.addFields(
                        ObjectUtil.singleFieldBuilder(
                            'Enlightenment achieved',
                            emojiConvert(
                                await this.orm.em
                                    .fork()
                                    .getRepository(User)
                                    .incrementEnlightenment(caller.id)
                            )
                        )
                    );
                    break;
            }
            purchaseEmbed.setDescription('Thank you for your purchase!');
            purchaseEmbed.setFooter({ text: 'Enjoy! | Come Back Again!' });
            collectInteraction.editReply({
                embeds: [purchaseEmbed],
                components: [],
            });

            collector.stop();
        });
    }

    /**
     * Karma Shop Artifact Purchase
     *
     * @param {ButtonInteraction} interaction
     * @param {GuildMember} caller
     * @returns {*}  {Promise<AlgorandPlugin.ClaimTokenResponse>}
     * @memberof KarmaCommand
     */
    async claimArtifact(
        interaction: ButtonInteraction,
        caller: GuildMember
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        // Get the users RX wallet
        const em = this.orm.em.fork();
        const algoWalletDb = em.getRepository(AlgoWallet);
        const userDb = em.getRepository(User);
        const algoTxnDB = em.getRepository(AlgoTxn);

        const rxWallet = await algoWalletDb.getWalletWithGreatestTokens(caller.id, this.assetType);

        let claimAsset = await this.checkStdAsset(interaction);
        await algoTxnDB.addPendingTxn(caller.id, this.artifactCost);
        let claimStatus = await this.algorand.claimArtifact(
            claimAsset.assetIndex,
            this.artifactCost,
            rxWallet.walletAddress
        );
        if (claimStatus.txId) {
            logger.info(
                `Artifact Purchased ${claimStatus.status?.txn.txn.aamt} ${this.assetName} for ${caller.user.username} (${caller.id})`
            );
            // add the artifact to the users inventory
            await userDb.incrementUserArtifacts(caller.id);
            await userDb.syncUserWallets(caller.id);
            await algoTxnDB.addTxn(caller.id, txnTypes.ARTIFACT, claimStatus);
            karmaArtifactWebhook(
                caller,
                claimStatus.status?.txn.txn.aamt.toLocaleString(),
                `https://algoexplorer.io/tx/${claimStatus.txId}`
            );
        }
        return claimStatus;
    }

    /**
     * The Karma Shop Embed
     *
     * @param {string} discordUserId
     * @returns {*}  {Promise<{
     *         shopEmbed: EmbedBuilder;
     *         shopButtonRow: ActionRowBuilder<MessageActionRowComponentBuilder>;
     *     }>}
     * @memberof KarmaCommand
     */
    async shopEmbed(discordUserId: string): Promise<{
        shopEmbed: EmbedBuilder;
        shopButtonRow: ActionRowBuilder<MessageActionRowComponentBuilder>;
    }> {
        // Get unclaimed karma
        const em = this.orm.em.fork();

        const userDb = em.getRepository(User);
        const algoWalletDb = em.getRepository(AlgoWallet);
        const algoStdTokenDb = em.getRepository(AlgoStdToken);
        const algoStdAsset = em.getRepository(AlgoStdAsset);

        const user = await userDb.getUserById(discordUserId);
        const karmaAsset = await algoStdAsset.getStdAssetByUnitName(this.assetType);

        const userUnclaimedKarma = await algoWalletDb.getAllUnClaimedTokensFromOptedInWallets(
            user.id,
            this.assetType
        );
        const userClaimedKarmaWallet = await algoWalletDb.getWalletWithGreatestTokens(
            user.id,
            this.assetType
        );
        const userClaimedKarmaStdAsset = await algoStdTokenDb.checkIfWalletHasStdAsset(
            userClaimedKarmaWallet,
            karmaAsset.assetIndex
        );
        const userClaimedKarma = userClaimedKarmaStdAsset?.tokens || 0;

        // total pieces are the total number of artifacts the user has and arms are the first 2 artifacts and legs are the last 2 artifacts
        const totalPieces = user.karmaShop.totalPieces;
        const totalEnlightened = user.karmaShop.totalEnlightened;

        // Set the total legs and arms and then calculate the individual pieces based on the total pieces
        let totalLegs = 0;
        let totalArms = 0;

        if (totalPieces > 0) {
            if (totalPieces % 2 == 0) {
                totalLegs = totalPieces / 2;
                totalArms = totalPieces / 2;
            } else {
                totalLegs = (totalPieces - 1) / 2;
                totalArms = (totalPieces + 1) / 2;
            }
        }
        const shopEmbed = new EmbedBuilder();
        if (userClaimedKarma >= this.artifactCost || totalPieces >= this.necessaryArtifacts) {
            shopEmbed.setColor('Green');
        } else {
            shopEmbed.setColor('Red');
        }
        shopEmbed.setTitle(`Welcome to The ${this.assetName} Shop`);
        shopEmbed.setImage(optimizedImageHostedUrl(optimizedImages.SHOP));
        shopEmbed.setFooter({
            text: `To claim your ${this.assetName} use ${inlineCode(
                '/karma claim'
            )}\nDon't see what you expect? Use ${inlineCode(
                '/wallet'
            )} to make sure your default wallet is set correctly`,
        });
        shopEmbed.setDescription(
            `Here you can use ${
                this.assetName
            } to achieve enlightenment!\n\n**To reach enlightenment you must gather ${emojiConvert(
                this.necessaryArtifacts.toString()
            )} artifacts**\n\n__Each artifact costs ${this.artifactCost.toLocaleString()} ${
                this.assetType
            }__\n\n*Your ${
                this.assetName
            } must be claimed and in the Algorand network before you can spend it!*\n\nYou currently have ${inlineCode(
                userClaimedKarma.toLocaleString()
            )} ${this.assetType} -- _${inlineCode(userUnclaimedKarma.toLocaleString())} unclaimed_`
        );
        let shopEmbedFields: APIEmbedField[] = [
            {
                name: 'Enlightenment',
                value: emojiConvert(totalEnlightened.toString()),
            },
            {
                name: 'Arms Gathered',
                value: emojiConvert(totalArms.toString()),
                inline: true,
            },
            {
                name: 'Legs Gathered',
                value: emojiConvert(totalLegs.toString()),
                inline: true,
            },
        ];
        // Create the buttons
        const buyArtifactButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel('Buy Artifact')
            .setCustomId('buyArtifact')
            .setDisabled(true);
        const buyEnlightenmentButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Success)
            .setLabel('Achieve Enlightenment')
            .setCustomId('buyEnlightenment')
            .setDisabled(true);

        if (userClaimedKarma >= this.artifactCost) {
            buyArtifactButton.setDisabled(false);
        }
        if (totalPieces >= this.necessaryArtifacts) {
            buyEnlightenmentButton.setDisabled(false);
            // Add a field to show how many enlightenments they are eligible for
            let enlightenments = Math.floor(totalPieces / this.necessaryArtifacts);
            shopEmbedFields[0].inline = true;
            shopEmbedFields.splice(
                1,
                0,
                {
                    name: 'Enlightenments Available',
                    value: emojiConvert(enlightenments.toString()),
                    inline: true,
                },
                { name: '\u200B', value: '\u200B', inline: true }
            );
        }
        shopEmbed.addFields(shopEmbedFields);
        const shopButtonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();

        shopButtonRow.addComponents(buyArtifactButton, buyEnlightenmentButton);
        return { shopEmbed, shopButtonRow };
    }

    /**
     * Check if the asset is in the database
     *
     * @template T
     * @param {T} interaction
     * @returns {*}  {Promise<AlgoStdAsset>}
     * @memberof KarmaCommand
     */
    async checkStdAsset<T extends CommandInteraction | ButtonInteraction>(
        interaction: T
    ): Promise<AlgoStdAsset> {
        const em = this.orm.em.fork();
        let claimAsset: AlgoStdAsset;
        try {
            claimAsset = await em.getRepository(AlgoStdAsset).getStdAssetByUnitName(this.assetType);
        } catch (_e) {
            logger.error(`Error getting ${this.assetType} Asset`);
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `Whoops tell the bot owner that the ${this.assetType} asset is not in the database`
            );
            return;
        }
        return claimAsset;
    }
}
