import type { ClaimTokenResponse } from '../model/types/algorand.js';
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
import { ButtonComponent, Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';
import { randomInt } from 'node:crypto';
import { injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../entities/algo-nft-asset.entity.js';
import { AlgoStdAsset } from '../entities/algo-std-asset.entity.js';
import { AlgoStdToken } from '../entities/algo-std-token.entity.js';
import { AlgoWallet } from '../entities/algo-wallet.entity.js';
import { User } from '../entities/user.entity.js';
import { optimizedImages } from '../enums/daruma-training.js';
import { GameAssetsNeeded } from '../guards/game-assets-needed.js';
import { Schedule } from '../model/framework/decorators/schedule.js';
import { TenorImageManager } from '../model/framework/manager/tenor-image.js';
import { GameAssets } from '../model/logic/game-assets.js';
import { Algorand } from '../services/algorand.js';
import { buildYesNoButtons } from '../utils/functions/algo-embeds.js';
import { assetName } from '../utils/functions/dt-embeds.js';
import { emojiConvert } from '../utils/functions/dt-emojis.js';
import { optimizedImageHostedUrl } from '../utils/functions/dt-images.js';
import logger from '../utils/functions/logger-factory.js';
import { karmaTipWebHook, txnWebHook, WebhookType } from '../utils/functions/web-hooks.js';
import { InteractionUtils, ObjectUtil } from '../utils/utils.js';
@Discord()
@injectable()
@Category('Karma')
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
@SlashGroup({ description: 'Admin Commands', name: 'admin' })
export default class KarmaCommand {
    constructor(
        private algorand: Algorand,
        private orm: MikroORM,
        private tenorManager: TenorImageManager,
        private gameAssets: GameAssets
    ) {}
    // Setup the number of artifacts necessary to reach enlightenment
    private noArmsOrLegs = true;
    private necessaryArtifacts = 4; // two arms and two legs
    private artifactCost = 2500;
    // Elixir Item Costs
    private itemElixirBase = 15;
    private uptoFiveCoolDown = this.itemElixirBase * 5;
    private uptoTenCoolDown = this.itemElixirBase * 10;
    private uptoFifteenCoolDown = this.itemElixirBase * 15;

    /**
     * Administrator Command to add KARMA to a user
     *
     * @param {GuildMember} karmaAddUser
     * @param {number} amount
     * @param {CommandInteraction} interaction
     * @returns {*}  {Promise<void>}
     * @memberof KarmaCommand
     */
    @Guard(PermissionGuard(['Administrator']), GameAssetsNeeded)
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
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        await interaction.deferReply({ ephemeral: true });

        const caller = InteractionUtils.getInteractionCaller(interaction);

        // ensure the amount is not negative
        if (amount < 0) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You cannot add negative ${this.gameAssets.karmaAsset?.name}`
            );
            return;
        }
        const em = this.orm.em.fork();
        const algoStdTokenDatabase = em.getRepository(AlgoStdToken);

        let newTokens = 0;
        const { walletWithMostTokens } = await em
            .getRepository(AlgoWallet)
            .allWalletsOptedIn(karmaAddUser.id, this.gameAssets.karmaAsset);
        if (walletWithMostTokens) {
            newTokens = await algoStdTokenDatabase.addUnclaimedTokens(
                walletWithMostTokens,
                this.gameAssets.karmaAsset?.id,
                amount
            );
        } else {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `User ${karmaAddUser} does not have a wallet to add ${this.gameAssets.karmaAsset?.name} to`
            );
            return;
        }

        // Provide an audit log of who added karma and to who
        logger.warn(
            `${caller.user.username} added ${amount} ${this.gameAssets.karmaAsset?.name} to ${karmaAddUser.user.username}`
        );
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Added ${amount.toLocaleString()} ${
                this.gameAssets.karmaAsset?.name
            } to ${karmaAddUser} -- Now has ${newTokens.toLocaleString()} ${
                this.gameAssets.karmaAsset?.name
            }`
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
    @Guard(RateLimit(TIME_UNIT.minutes, 1), GameAssetsNeeded)
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
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        await interaction.deferReply({ ephemeral: false });

        const caller = InteractionUtils.getInteractionCaller(interaction);
        // get the caller's wallet

        try {
            // Ensure the user is not tipping themselves
            if (tipUser.id === caller.id) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,
                    `You cannot tip yourself ${this.gameAssets.karmaAsset?.name}`
                );
                return;
            }
            // Ensure the user is not tipping a bot
            if (tipUser.user.bot) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,
                    `You cannot tip a bot ${this.gameAssets.karmaAsset?.name}`
                );
                return;
            }
            const em = this.orm.em.fork();
            // Check if the user has a RX wallet
            const { walletWithMostTokens: tipUserRxWallet } = await em
                .getRepository(AlgoWallet)
                .allWalletsOptedIn(tipUser.id, this.gameAssets.karmaAsset);

            if (!tipUserRxWallet) {
                await InteractionUtils.replyOrFollowUp(interaction, {
                    content: `The User you are attempting to Tip does not have a wallet that can receive ${
                        this.gameAssets.karmaAsset?.name
                    }\nHave them check ${inlineCode(
                        '/wallet'
                    )} and ensure they have opted into the ${
                        this.gameAssets.karmaAsset?.name
                    } token.`,
                    components: [this.walletButtonCreator()],
                });
                return;
            }
            // Build the embed to show that the tip is being processed
            const tipAssetEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
            const tipAssetEmbed = new EmbedBuilder()
                .setTitle(`Tip ${this.gameAssets.karmaAsset?.name}`)
                .setDescription(
                    `Processing Tip of ${karmaAmount.toLocaleString()} ${
                        this.gameAssets.karmaAsset?.name
                    } to ${tipUser}...`
                )
                .setAuthor({
                    name: caller.user.username,
                    iconURL: caller.user.avatarURL() ?? undefined,
                })
                .setTimestamp();
            await InteractionUtils.replyOrFollowUp(interaction, {
                embeds: [tipAssetEmbed],
            });
            // Send the tip
            const { walletWithMostTokens: callerRxWallet } = await em
                .getRepository(AlgoWallet)
                .allWalletsOptedIn(caller.id, this.gameAssets.karmaAsset);
            if (!callerRxWallet) throw new Error('Caller Wallet Not Found');
            const tipTxn = await this.algorand.tipToken(
                this.gameAssets.karmaAsset?.id,
                karmaAmount,
                tipUserRxWallet.address,
                callerRxWallet.address
            );
            if (tipTxn.txId) {
                logger.info(
                    `Tipped ${tipTxn.status?.txn.txn.aamt} ${this.gameAssets.karmaAsset?.name} from ${caller.user.username} (${caller.id}) to ${tipUser.user.username} (${tipUser.id})`
                );
                tipAssetEmbed.setDescription(
                    `Tipped ${tipTxn.status?.txn.txn.aamt?.toLocaleString()} ${
                        this.gameAssets.karmaAsset?.name
                    } to ${tipUser}`
                );
                tipAssetEmbed.addFields(
                    {
                        name: 'Txn ID',
                        value: tipTxn.txId ?? 'Unknown',
                    },
                    {
                        name: 'Txn Hash',
                        value: tipTxn.status?.['confirmed-round']?.toString() ?? 'Unknown',
                    },
                    {
                        name: 'Transaction Amount',
                        value: tipTxn.status?.txn.txn.aamt?.toLocaleString() ?? 'Unknown',
                    }
                );
                // add button for algoexplorer
                const algoExplorerButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('AlgoExplorer')
                    .setURL(`https://algoexplorer.io/tx/${tipTxn.txId}`);
                tipAssetEmbedButton.addComponents(algoExplorerButton);
                await em.getRepository(User).syncUserWallets(caller.id);

                karmaTipWebHook(caller, tipUser, tipTxn);
            } else {
                tipAssetEmbed.setDescription(
                    `There was an error sending the ${this.gameAssets.karmaAsset?.name} to ${tipUser}`
                );
                tipAssetEmbed.addFields({
                    name: 'Error',
                    value: JSON.stringify(tipTxn),
                });
            }
            const embedButton:
                | Array<ActionRowBuilder<MessageActionRowComponentBuilder>>
                | Array<undefined> =
                tipAssetEmbedButton.components.length > 0 ? [tipAssetEmbedButton] : [];
            await InteractionUtils.replyOrFollowUp(interaction, {
                embeds: [tipAssetEmbed],
                components: embedButton,
            });
        } catch {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `The User ${tipUser} you are attempting to tip cannot receive ${this.gameAssets.karmaAsset?.name} because they have not registered.`
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
    @Guard(RateLimit(TIME_UNIT.minutes, 2), GameAssetsNeeded)
    async karmaClaim(interaction: CommandInteraction): Promise<void> {
        await this.claim(interaction);
    }

    @Slash({
        name: 'claim',
        description: 'Claim your KARMA',
    })
    @SlashGroup('karma')
    @Guard(RateLimit(TIME_UNIT.minutes, 2), GameAssetsNeeded)
    async claim(interaction: CommandInteraction): Promise<void> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        await interaction.deferReply({ ephemeral: true });

        const caller = InteractionUtils.getInteractionCaller(interaction);
        const em = this.orm.em.fork();
        const userDatabase = em.getRepository(User);
        const algoStdToken = em.getRepository(AlgoStdToken);
        const optedInWallets = await this.getOptedInWallets(
            interaction,
            this.gameAssets.karmaAsset
        );
        if (!optedInWallets) return;
        // filter out any opted in wallet that does not have unclaimed KARMA
        const walletsWithUnclaimedKarma: Array<AlgoWallet> = [];
        // make tuple with wallet and unclaimed tokens
        const walletsWithUnclaimedKarmaTuple: Array<[AlgoWallet, number]> = [];
        for (const wallet of optedInWallets) {
            const unclaimedKarma = await algoStdToken.getWalletWithUnclaimedTokens(
                wallet,
                this.gameAssets.karmaAsset?.id
            );
            if (unclaimedKarma && unclaimedKarma?.unclaimedTokens > 0) {
                walletsWithUnclaimedKarma.push(wallet);
                walletsWithUnclaimedKarmaTuple.push([wallet, unclaimedKarma.unclaimedTokens]);
            }
        }
        const walletsWithUnclaimedKarmaFields: Array<APIEmbedField> = [];

        if (walletsWithUnclaimedKarma.length > 0) {
            // build string of wallets with unclaimed KARMA
            for (const wallet of walletsWithUnclaimedKarmaTuple) {
                walletsWithUnclaimedKarmaFields.push({
                    name: ObjectUtil.ellipseAddress(wallet[0].address),
                    value: `${wallet[1].toLocaleString()} ${this.gameAssets.karmaAsset?.name}`,
                    inline: true,
                });
            }
        } else {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You don't have any ${this.gameAssets.karmaAsset?.name} to claim!`
            );
            return;
        }

        const claimEmbedConfirm = new EmbedBuilder();
        claimEmbedConfirm.setTitle(`Claim ${this.gameAssets.karmaAsset?.name}`);
        const oneWallet = `\n\nYou have 1 wallet with unclaimed KARMA`;
        const greaterThanOneWallet = `\n\nYou have ${walletsWithUnclaimedKarma.length} wallets with unclaimed KARMA\n\nThere will be ${walletsWithUnclaimedKarma.length} transfers to complete these claims.\n\n`;
        const walletDesc = walletsWithUnclaimedKarma.length > 1 ? greaterThanOneWallet : oneWallet;
        claimEmbedConfirm.setDescription(
            `__**Are you sure you want to claim ${this.gameAssets.karmaAsset?.name}?**__${walletDesc}`
        );
        claimEmbedConfirm.addFields(walletsWithUnclaimedKarmaFields);
        const buttonRow = buildYesNoButtons('claim');
        const message = await interaction.followUp({
            components: [buttonRow],
            embeds: [claimEmbedConfirm],
        });
        const claimEmbed = new EmbedBuilder();
        const claimEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
        claimEmbed.setTitle(`Claim ${this.gameAssets.karmaAsset?.name}`);
        const claimEmbedFields: APIEmbedField[] = [];
        const claimEmbedButtons: ButtonBuilder[] = [];
        const collector = message.createMessageComponentCollector();
        let buttonClicked = false;
        collector.on('collect', async (collectInteraction: ButtonInteraction) => {
            if (buttonClicked) return;
            buttonClicked = true;
            if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
            await collectInteraction.deferUpdate();
            await collectInteraction.editReply({
                components: [],
                embeds: [],
                content: `${this.gameAssets.karmaAsset?.name} claim check in progress...`,
            });

            if (collectInteraction.customId.includes('yes')) {
                await collectInteraction.editReply({
                    content: `Claiming ${this.gameAssets.karmaAsset?.name}...`,
                });
                // Create claim response embed looping through wallets with unclaimed KARMA
                for (const wallet of walletsWithUnclaimedKarmaTuple) {
                    const claimStatus = await this.algorand.claimToken(
                        this.gameAssets.karmaAsset?.id,
                        wallet[1],
                        wallet[0].address
                    );
                    // remove unclaimed tokens from db
                    await algoStdToken.removeUnclaimedTokens(
                        wallet[0],
                        this.gameAssets.karmaAsset?.id,
                        wallet[1]
                    );
                    if (claimStatus.txId) {
                        logger.info(
                            `Claimed ${claimStatus.status?.txn.txn.aamt} ${this.gameAssets.karmaAsset?.name} for ${caller.user.username} (${caller.id})`
                        );
                        claimEmbedFields.push(
                            {
                                name: 'Txn ID',
                                value: claimStatus.txId,
                            },
                            {
                                name: 'Txn Hash',
                                value: claimStatus.status?.['confirmed-round']?.toString() ?? 'N/A',
                            },
                            {
                                name: 'Transaction Amount',
                                value: claimStatus.status?.txn.txn.aamt?.toLocaleString() ?? 'N/A',
                            }
                        );
                        // add button for algoexplorer
                        claimEmbedButtons.push(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setLabel(`AlgoExplorer`)
                                .setURL(`https://algoexplorer.io/tx/${claimStatus.txId}`)
                        );
                        txnWebHook(caller, claimStatus, WebhookType.CLAIM);
                    } else {
                        // give back unclaimed tokens
                        await algoStdToken.addUnclaimedTokens(
                            wallet[0],
                            this.gameAssets.karmaAsset?.id,
                            wallet[1]
                        );
                        claimEmbedFields.push({
                            name: 'Error',
                            value: JSON.stringify(claimStatus),
                        });
                    }
                }
                claimEmbed.addFields(claimEmbedFields);
                claimEmbedButton.addComponents(claimEmbedButtons);

                await userDatabase.syncUserWallets(caller.id);
            }
            if (collectInteraction.customId.includes('no')) {
                claimEmbed.setDescription('No problem! Come back when you are ready!');
            }
            // check for button
            const embedButton:
                | Array<ActionRowBuilder<MessageActionRowComponentBuilder>>
                | Array<undefined> =
                claimEmbedButton.components.length > 0 ? [claimEmbedButton] : [];
            await collectInteraction.editReply({
                content: '',
                embeds: [claimEmbed],
                components: embedButton,
            });

            collector.stop();
        });
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
    @Guard(GameAssetsNeeded)
    async shop(interaction: CommandInteraction): Promise<void> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        if (!this.gameAssets.enlightenmentAsset) throw new Error('Enlightenment Asset Not Found');
        const caller = InteractionUtils.getInteractionCaller(interaction);

        await interaction.deferReply({ ephemeral: true });

        // Get the shop embed
        const karmaOptedIn = await this.getOptedInWallets(interaction, this.gameAssets.karmaAsset);
        if (!karmaOptedIn) return;
        const enlightenmentOptedIn = await this.getOptedInWallets(
            interaction,
            this.gameAssets.enlightenmentAsset
        );
        if (!enlightenmentOptedIn) return;

        const { shopEmbed, shopButtonRow } = await this.shopEmbed(caller.id);
        const message = await interaction.followUp({
            embeds: [shopEmbed],
            components: [shopButtonRow],
        });
        // Create the collector
        const collector = message.createMessageComponentCollector();
        collector.on('collect', async (collectInteraction: ButtonInteraction) => {
            await collectInteraction.deferUpdate();
            // Change the footer to say please wait and remove the buttons and fields
            shopEmbed.setColor('Gold');
            shopEmbed.spliceFields(0, 25);
            shopEmbed.setFooter({ text: 'Please wait...' });
            await collectInteraction.editReply({ embeds: [shopEmbed], components: [] });

            let claimStatus: ClaimTokenResponse;
            let quantity = 1;
            switch (collectInteraction.customId) {
                case 'buyMaxArtifacts':
                case 'buyArtifact': {
                    quantity = collectInteraction.customId.includes('buyMaxArtifacts')
                        ? this.necessaryArtifacts
                        : 1;
                    // subtract the cost from the users wallet
                    shopEmbed.setDescription('Buying an artifact...');
                    await collectInteraction.editReply({ embeds: [shopEmbed], components: [] });

                    // Clawback the tokens and purchase the artifact
                    claimStatus = await this.claimArtifact(collectInteraction, caller, quantity);

                    if (claimStatus.txId) {
                        shopEmbed.setImage(optimizedImageHostedUrl(optimizedImages.ARTIFACT));
                        shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Artifact', 'Claimed!'));
                        shopEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.txId)
                        );
                    } else {
                        shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Artifact', 'Error!'));
                    }
                    break;
                }
                case 'buyEnlightenment': {
                    // subtract the cost from the users wallet
                    shopEmbed.setDescription('Buying enlightenment...');
                    await collectInteraction.editReply({ embeds: [shopEmbed], components: [] });

                    claimStatus = await this.claimEnlightenment(collectInteraction, caller);
                    if (claimStatus.txId) {
                        shopEmbed.setImage(optimizedImageHostedUrl(optimizedImages.ENLIGHTENMENT));
                        shopEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Enlightenment', 'Claimed!')
                        );
                        shopEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.txId)
                        );
                    } else {
                        shopEmbed.addFields(
                            ObjectUtil.singleFieldBuilder('Enlightenment', 'Error!')
                        );
                    }
                    break;
                }
            }
            shopEmbed.setDescription('Thank you for your purchase!');
            shopEmbed.setFooter({ text: 'Enjoy! | Come Back Again!' });
            collectInteraction.editReply({
                embeds: [shopEmbed],
                components: [],
            });

            collector.stop();
        });
    }

    /**
     * This is how you claim an artifact
     *
     * @param {ButtonInteraction} interaction
     * @param {GuildMember} caller
     * @param {number} [quantity=1]
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof KarmaCommand
     */
    async claimArtifact(
        interaction: ButtonInteraction,
        caller: GuildMember,
        quantity: number = 1
    ): Promise<ClaimTokenResponse> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        // Get the users RX wallet
        const em = this.orm.em.fork();
        const userDatabase = em.getRepository(User);

        const { walletWithMostTokens: rxWallet } = await em
            .getRepository(AlgoWallet)
            .allWalletsOptedIn(caller.id, this.gameAssets.karmaAsset);
        if (!rxWallet) throw new Error('No Wallets Opted In');
        const totalArtifactCost = this.artifactCost * quantity;
        const claimStatus = await this.algorand.purchaseItem(
            'artifact',
            this.gameAssets.karmaAsset?.id,
            totalArtifactCost,
            rxWallet.address
        );
        const plural = quantity > 1 ? 's' : '';
        if (claimStatus.txId) {
            logger.info(
                `${quantity} Artifact${plural} Purchased ${claimStatus.status?.txn.txn.aamt} ${this.gameAssets.karmaAsset?.name} for ${caller.user.username} (${caller.id})`
            );
            // add the artifact to the users inventory
            await userDatabase.updateUserPreToken(caller.id, quantity);
            await userDatabase.syncUserWallets(caller.id);
            txnWebHook(caller, claimStatus, WebhookType.ARTIFACT);
        }
        return claimStatus;
    }
    /**
     * Karma Shop Enlightenment Purchase
     *
     * @param {ButtonInteraction} interaction
     * @param {GuildMember} caller
     * @returns {*}  {Promise<ClaimTokenResponse>}
     * @memberof KarmaCommand
     */
    async claimEnlightenment(
        interaction: ButtonInteraction,
        caller: GuildMember
    ): Promise<ClaimTokenResponse> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        if (!this.gameAssets.enlightenmentAsset) throw new Error('Enlightenment Asset Not Found');

        // Get the users RX wallet
        const em = this.orm.em.fork();
        const userDatabase = em.getRepository(User);

        const { walletWithMostTokens: rxWallet } = await em
            .getRepository(AlgoWallet)
            .allWalletsOptedIn(caller.id, this.gameAssets.enlightenmentAsset);
        if (!rxWallet) {
            logger.error(
                `Enlightenment Purchase Failed for ${caller.user.username} (${caller.id})`
            );
            return { txId: undefined };
        }
        const claimStatus = await this.algorand.claimToken(
            this.gameAssets.enlightenmentAsset.id,
            1,
            rxWallet.address,
            'Enlightenment'
        );
        if (claimStatus.txId) {
            logger.info(
                `Enlightenment Purchased ${claimStatus.status?.txn.txn.aamt} ${this.gameAssets.enlightenmentAsset.name} for ${caller.user.username} (${caller.id})`
            );
            await userDatabase.updateUserPreToken(caller.id, -this.necessaryArtifacts);
            await userDatabase.syncUserWallets(caller.id);
            txnWebHook(caller, claimStatus, WebhookType.ENLIGHTENMENT);
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
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        if (!this.gameAssets.enlightenmentAsset) throw new Error('Enlightenment Asset Not Found');

        // Get unclaimed karma
        const em = this.orm.em.fork();

        const userDatabase = em.getRepository(User);
        const algoStdTokenDatabase = em.getRepository(AlgoStdToken);

        const user = await userDatabase.getUserById(discordUserId);
        const { walletWithMostTokens: userClaimedKarmaWallet, unclaimedTokens: unclaimedKarma } =
            await em
                .getRepository(AlgoWallet)
                .allWalletsOptedIn(user.id, this.gameAssets.karmaAsset);
        if (!userClaimedKarmaWallet) throw new Error('No Wallets Opted In');
        const userClaimedKarmaStdAsset = await algoStdTokenDatabase.getStdAssetByWallet(
            userClaimedKarmaWallet,
            this.gameAssets.karmaAsset?.id
        );
        const userEnlightenmentStdAsset = await algoStdTokenDatabase.getStdAssetByWallet(
            userClaimedKarmaWallet,
            this.gameAssets.enlightenmentAsset.id
        );
        const userClaimedKarma = userClaimedKarmaStdAsset?.tokens || 0;

        // total pieces are the total number of artifacts the user has and arms are the first 2 artifacts and legs are the last 2 artifacts
        const totalPieces = user.preToken;
        const totalEnlightened = userEnlightenmentStdAsset?.tokens || 0;
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
        const armsAndLegsFields: Array<APIEmbedField> = [
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
        const justArtifactsField: APIEmbedField = {
            name: 'Artifacts Gathered',
            value: emojiConvert(totalPieces.toString()),
            inline: true,
        };
        const enlightenMentField: APIEmbedField = {
            name: 'Enlightenment',
            value: emojiConvert(totalEnlightened.toString()),
        };

        const shopEmbed = new EmbedBuilder();
        if (userClaimedKarma >= this.artifactCost || totalPieces >= this.necessaryArtifacts) {
            shopEmbed.setColor('Green');
        } else {
            shopEmbed.setColor('Red');
        }
        shopEmbed.setTitle(`Welcome to The ${this.gameAssets.karmaAsset?.name} Shop`);
        shopEmbed.setImage(optimizedImageHostedUrl(optimizedImages.SHOP));
        shopEmbed.setFooter({
            text: `To claim your ${this.gameAssets.karmaAsset?.name} use ${inlineCode(
                '/karma claim'
            )}\nDon't see what you expect? Use ${inlineCode('/wallet')} to verify.`,
        });
        shopEmbed.setDescription(
            `Here you can use ${
                this.gameAssets.karmaAsset?.name
            } to achieve enlightenment!\n\n**To reach enlightenment you must gather ${emojiConvert(
                this.necessaryArtifacts.toString()
            )} artifacts**\n\n__Each artifact costs ${this.artifactCost.toLocaleString()} ${
                this.gameAssets.karmaAsset?.unitName
            }__\n\n*Your ${
                this.gameAssets.karmaAsset?.name
            } must be claimed and in the Algorand network before you can spend it!*\n\nYou currently have ${inlineCode(
                userClaimedKarma.toLocaleString()
            )} ${this.gameAssets.karmaAsset?.unitName} -- _${inlineCode(
                unclaimedKarma.toLocaleString()
            )} unclaimed_`
        );

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
        // add either arms and legs or just artifacts to an embed
        const shopEmbedFields = this.noArmsOrLegs ? [justArtifactsField] : armsAndLegsFields;
        // add enlightenment to the embed
        shopEmbedFields.push(enlightenMentField);

        if (totalPieces >= this.necessaryArtifacts && userEnlightenmentStdAsset?.optedIn) {
            buyEnlightenmentButton.setDisabled(false);
            // Add a field to show how many enlightenments they are eligible for
            const enlightenments = Math.floor(totalPieces / this.necessaryArtifacts);
            if (shopEmbedFields[0]) {
                shopEmbedFields[0].inline = true;
            }
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
        if (userClaimedKarma >= this.artifactCost * this.necessaryArtifacts) {
            const buyMaxArtifactButton = new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setLabel(`Buy ${this.necessaryArtifacts} Artifacts`)
                .setCustomId('buyMaxArtifacts');
            shopButtonRow.addComponents(buyMaxArtifactButton);
        }
        shopButtonRow.addComponents(buyArtifactButton, buyEnlightenmentButton);

        return { shopEmbed, shopButtonRow };
    }
    @ButtonComponent({ id: 'randomCoolDownOffer' })
    @Guard(GameAssetsNeeded)
    async shadyShop(interaction: ButtonInteraction): Promise<void> {
        const caller = InteractionUtils.getInteractionCaller(interaction);

        await interaction.deferReply({ ephemeral: true });

        // Get the shop embed
        const { shadyEmbeds, shadyComponents, content } = await this.shadyShopEmbed(caller.id);
        if (content) {
            await InteractionUtils.replyOrFollowUp(interaction, { content });
            return;
        }
        if (!shadyEmbeds || !shadyComponents) {
            await InteractionUtils.replyOrFollowUp(interaction, {
                content: 'Something went wrong, please try again later.',
            });
            return;
        }
        const message = await interaction.followUp({
            embeds: [shadyEmbeds],
            components: [shadyComponents],
        });

        // Create the collector
        const collector = message.createMessageComponentCollector();
        collector.on('collect', async (collectInteraction: ButtonInteraction) => {
            await collectInteraction.deferUpdate();
            // Change the footer to say please wait and remove the buttons and fields
            shadyEmbeds.setColor('Gold');
            shadyEmbeds.spliceFields(0, 25);
            shadyEmbeds.setDescription('Churning the elixir...');
            shadyEmbeds.setFooter({ text: 'Please wait...' });
            await collectInteraction.editReply({ embeds: [shadyEmbeds], components: [] });

            let elixirPrice: number;
            let numberOfCoolDowns: number;
            switch (collectInteraction.customId) {
                case 'uptoFiveCoolDown': {
                    // subtract the cost from the users wallet
                    shadyEmbeds.setDescription('Buying an elixir for 5 cool downs... maybe...');
                    elixirPrice = this.uptoFiveCoolDown;
                    numberOfCoolDowns = randomInt(3, 5);
                    break;
                }
                case 'uptoTenCoolDown': {
                    // subtract the cost from the users wallet
                    shadyEmbeds.setDescription(
                        'Buying an elixir for 10 cool downs... yeah 10 cool downs...'
                    );
                    elixirPrice = this.uptoTenCoolDown;
                    numberOfCoolDowns = randomInt(5, 10);
                    break;
                }
                case 'uptoFifteenCoolDown': {
                    // subtract the cost from the users wallet
                    shadyEmbeds.setDescription(
                        'Buying an elixir for 15 cool downs... Or you might lose your hair..'
                    );
                    elixirPrice = this.uptoFifteenCoolDown;
                    numberOfCoolDowns = randomInt(10, 15);
                    break;
                }
                default: {
                    return;
                }
            }
            // subtract the cost from the users wallet
            await collectInteraction.editReply({ embeds: [shadyEmbeds], components: [] });

            // Clawback the tokens and purchase the elixir
            const thisStatus = await this.claimElixir(
                collectInteraction,
                elixirPrice,
                numberOfCoolDowns,
                caller
            );

            if (thisStatus.claimStatus.txId) {
                shadyEmbeds.addFields(ObjectUtil.singleFieldBuilder('Elixir', 'Purchased!'));
                shadyEmbeds.addFields(
                    ObjectUtil.singleFieldBuilder('Txn ID', thisStatus.claimStatus.txId)
                );
                // Build array of ResetAsset Names
                const assetNames: Array<string> = [];
                for (const asset of thisStatus.resetAssets) {
                    assetNames.push(assetName(asset));
                }
                // Add the reset assets to the embed
                shadyEmbeds.addFields(
                    ObjectUtil.singleFieldBuilder('Reset Assets', assetNames.join(', '))
                );

                shadyEmbeds.setDescription('Hope you enjoy the elixir..');
                shadyEmbeds.setFooter({ text: 'No Refunds!' });
            } else {
                shadyEmbeds.addFields(
                    ObjectUtil.singleFieldBuilder('Elixir', 'Failed to purchase!')
                );
            }
            collectInteraction.editReply({
                embeds: [shadyEmbeds],
                components: [],
            });

            collector.stop();
        });
    }

    async shadyShopEmbed(userId: string): Promise<
        | { content: string; shadyEmbeds?: undefined; shadyComponents?: undefined }
        | {
              shadyEmbeds: EmbedBuilder;
              shadyComponents: ActionRowBuilder<MessageActionRowComponentBuilder>;
              content?: undefined;
          }
    > {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');

        const em = this.orm.em.fork();
        const userDatabase = em.getRepository(User);
        const algoStdTokenDatabase = em.getRepository(AlgoStdToken);

        const user = await userDatabase.getUserById(userId);
        const { walletWithMostTokens: userClaimedKarmaWallet, unclaimedTokens: unclaimedKarma } =
            await em
                .getRepository(AlgoWallet)
                .allWalletsOptedIn(user.id, this.gameAssets.karmaAsset);
        if (!userClaimedKarmaWallet) throw new Error('User has no claimed karma wallet');
        const userClaimedKarmaStdAsset = await algoStdTokenDatabase.getStdAssetByWallet(
            userClaimedKarmaWallet,
            this.gameAssets.karmaAsset?.id
        );
        const userClaimedKarma = userClaimedKarmaStdAsset?.tokens || 0;

        if (userClaimedKarma < this.uptoFiveCoolDown) {
            if (unclaimedKarma > this.uptoFiveCoolDown) {
                return {
                    content: `You don't have enough ${
                        this.gameAssets.karmaAsset?.name
                    }!!!\n\nYou have unclaimed ${
                        this.gameAssets.karmaAsset?.name
                    }!\n\nClaim it with ${inlineCode('/claim')}\n\nThen try again.`,
                };
            }
            return {
                content: `You don't have enough ${this.gameAssets.karmaAsset?.name}.\n\nCome back when you have at least ${this.uptoFiveCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
            };
        }
        // Build the embed
        const tenorUrl = await this.tenorManager.fetchRandomTenorGif('trust me, shady, scary');

        const coolDownOfferEmbed = new EmbedBuilder()
            .setTitle('A Shady Offer')
            .setDescription(
                `Have I got a deal for you! I just figured out a new recipe for a for an elixir that works every time!\n\n
            But don't tell anyone about this, it's a secret!\n\n
            I have a limited supply of this elixir and I'm willing to sell it to you for a limited time!\n\n
            Don't let the price fool you, this is a once in a lifetime deal!\n\n
            Did I mention that this elixir works every time?\n\n
            Don't listen to anyone who says otherwise!\n\n`
            )
            .setImage(tenorUrl);
        // Build the fields for the elixirs and their prices and add them to the embed if the user has enough karma
        const uptoFiveCoolDownField = {
            name: '5.. yeah 5.. Daruma cooldowns removed!',
            value: `For only ${this.uptoFiveCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
            inline: true,
        };
        const uptoTenCoolDownField = {
            name: '10 __guaranteed__ Daruma cooldowns removed! (no refunds)',
            value: `For only ${this.uptoTenCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
            inline: true,
        };
        const uptoFifteenCoolDownField = {
            name: '15 Daruma cooldowns removed! (no refunds no questions asked no telling anyone)',
            value: `For only ${this.uptoFifteenCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
            inline: true,
        };
        if (userClaimedKarma >= this.uptoFiveCoolDown) {
            coolDownOfferEmbed.addFields(uptoFiveCoolDownField);
        }
        if (userClaimedKarma >= this.uptoTenCoolDown) {
            coolDownOfferEmbed.addFields(uptoTenCoolDownField);
        }
        if (userClaimedKarma >= this.uptoFifteenCoolDown) {
            coolDownOfferEmbed.addFields(uptoFifteenCoolDownField);
        }
        // Build the buttons
        const uptoFiveCoolDownButton = new ButtonBuilder()
            .setCustomId(`uptoFiveCoolDown`)
            .setLabel('5')
            .setStyle(ButtonStyle.Primary);
        const uptoTenCoolDownButton = new ButtonBuilder()
            .setCustomId(`uptoTenCoolDown`)
            .setLabel('10')
            .setStyle(ButtonStyle.Secondary);
        const uptoFifteenCoolDownButton = new ButtonBuilder()
            .setCustomId(`uptoFifteenCoolDown`)
            .setLabel('15')
            .setStyle(ButtonStyle.Danger);
        const uptoFiveCoolDownButtonRow =
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                uptoFiveCoolDownButton,
                uptoTenCoolDownButton,
                uptoFifteenCoolDownButton
            );
        // Send the embed and buttons
        return {
            shadyEmbeds: coolDownOfferEmbed,
            shadyComponents: uptoFiveCoolDownButtonRow,
        };
    }
    async claimElixir(
        interaction: ButtonInteraction,
        elixirCost: number,
        coolDowns: number,
        caller: GuildMember
    ): Promise<{
        claimStatus: ClaimTokenResponse;
        resetAssets: Array<AlgoNFTAsset>;
    }> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        // Get the users RX wallet
        const em = this.orm.em.fork();
        const userDatabase = em.getRepository(User);
        const algoWalletDatabase = em.getRepository(AlgoWallet);
        const { walletWithMostTokens: rxWallet } = await algoWalletDatabase.allWalletsOptedIn(
            caller.id,
            this.gameAssets.karmaAsset
        );
        if (!rxWallet) throw new Error('User has no claimed karma wallet');
        const claimStatus = await this.algorand.purchaseItem(
            'karma-elixir',
            this.gameAssets.karmaAsset?.id,
            elixirCost,
            rxWallet.address
        );

        let resetAssets: Array<AlgoNFTAsset> = [];
        if (claimStatus.txId) {
            logger.info(
                `Elixir Purchased ${claimStatus.status?.txn.txn.aamt} ${this.gameAssets.karmaAsset?.name} for ${caller.user.username} (${caller.id})`
            );
            resetAssets = await algoWalletDatabase.randomAssetCoolDownReset(caller.id, coolDowns);
            await userDatabase.syncUserWallets(caller.id);

            txnWebHook(caller, claimStatus, WebhookType.ELIXIR);
        }
        return { claimStatus, resetAssets };
    }
    async getOptedInWallets(
        interaction: CommandInteraction,
        asset: AlgoStdAsset
    ): Promise<Array<AlgoWallet> | null> {
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const em = this.orm.em.fork();
        const algoWalletDatabase = em.getRepository(AlgoWallet);
        const { optedInWallets } = await algoWalletDatabase.allWalletsOptedIn(caller.id, asset);
        if (optedInWallets.length > 0) {
            return optedInWallets;
        }
        const optInButton = this.walletButtonCreator();
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: `You do not have a wallet validated that can receive ${
                asset.name
            }\nCheck your wallets with the command ${inlineCode(
                '/wallet'
            )} and ensure you have OPTED into the ${asset.name} token.`,
            components: [optInButton],
        });
        return null;
    }
    walletButtonCreator(): ActionRowBuilder<MessageActionRowComponentBuilder> {
        const walletButton = new ButtonBuilder()
            .setCustomId('walletSetup')
            .setLabel('Setup Wallet')
            .setStyle(ButtonStyle.Primary);
        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(walletButton);
    }
    // Scheduled the first day of the month at 1am
    @Schedule('0 1 1 * *')
    async monthlyClaim(): Promise<void> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        logger.info('Monthly Claim Started');
        await this.algorand.unclaimedAutomated(50, this.gameAssets.karmaAsset);
        logger.info('Monthly Claim Finished');
    }
    // Scheduled at 2am every day
    @Schedule('0 2 * * *')
    async dailyClaim(): Promise<void> {
        if (!this.gameAssets.karmaAsset) throw new Error('Karma Asset Not Found');
        logger.info('Daily Claim Started');
        await this.algorand.unclaimedAutomated(200, this.gameAssets.karmaAsset);
        logger.info('Daily Claim Finished');
    }
}
