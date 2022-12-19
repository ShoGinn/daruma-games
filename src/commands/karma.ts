import InteractionUtils = DiscordUtils.InteractionUtils;
import { Category, NotBot, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { Loaded, MikroORM } from '@mikro-orm/core';
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
import { AlgoTxn } from '../entities/AlgoTxn.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { User } from '../entities/User.js';
import { optimizedImages, txnTypes } from '../enums/dtEnums.js';
import { BotOwnerOnly } from '../guards/BotOwnerOnly.js';
import { Algorand } from '../services/Algorand.js';
import { yesNoButtons } from '../utils/functions/algoEmbeds.js';
import { emojiConvert } from '../utils/functions/dtEmojis.js';
import { optimizedImageHostedUrl } from '../utils/functions/dtImages.js';
import logger, { claimKarmaWebHook } from '../utils/functions/LoggerFactory.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';
@Discord()
@injectable()
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
export default class KarmaCommand {
    constructor(private algorand: Algorand, private orm: MikroORM) {}
    private assetName = 'KARMA';
    private assetType = 'KRMA';
    // Setup the number of artifacts necessary to reach enlightenment
    private necessaryArtifacts = 4; // two arms and two legs
    private artifactCost = 1000; // 1000 KRMA per artifact

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
        const dbUser = await em.getRepository(User).getUserById(karmaAddUser.id);
        await em.getRepository(User).addKarma(karmaAddUser.id, amount);
        // Provide an audit log of who added karma and to who
        logger.warn(
            `${caller.user.username} added ${amount} ${this.assetName} to ${karmaAddUser.user.username}`
        );
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Added ${amount.toLocaleString()} ${
                this.assetName
            } to ${karmaAddUser} -- Now has ${dbUser.karma.toLocaleString()} ${this.assetName}`
        );
    }
    @Category('Karma')
    @Slash({
        name: 'tip',
        description: 'Tip Someone some KARMA -- So Kind of You!',
    })
    @SlashGroup('karma')
    //@Guard(RateLimit(TIME_UNIT.minutes, 2))
    @Guard(BotOwnerOnly)
    async tip(
        @SlashOption({
            description: 'Who To Tip?',
            name: 'username',
            required: true,
            type: ApplicationCommandOptionType.User,
        })
        tipUser: GuildMember,
        @SlashOption({
            description: 'How Much are you Tipping?',
            name: 'amount',
            required: true,
            type: ApplicationCommandOptionType.Number,
        })
        karmaAmount: number,

        interaction: CommandInteraction
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: false });
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const em = this.orm.em.fork();
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
            const tipUserRxWallet = await em.getRepository(User).getRXWallet(user.id);
            if (!tipUserRxWallet) {
                await InteractionUtils.replyOrFollowUp(
                    interaction,
                    `The User you are attempting to Tip does not have a wallet that can receive ${
                        this.assetName
                    }\nHave them check ${inlineCode(
                        '/wallet'
                    )} and ensure their desired OPTED-IN wallet is **default** so it can receive the ${
                        this.assetName
                    } token.`
                );
                return;
            }
        } catch (error) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `The User you are attempting to tip cannot receive ${this.assetName} because they have not registered.`
            );
            return;
        }
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
        const caller = InteractionUtils.getInteractionCaller(interaction);
        const em = this.orm.em.fork();
        const user = await em.getRepository(User).getUserById(caller.id);
        const userAsset = user.karma;
        const rxWallet = await em.getRepository(User).getRXWallet(caller.id);
        if (!rxWallet) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You do not have a wallet validated that can receive ${
                    this.assetName
                }\nCheck your wallets with the command ${inlineCode(
                    '/wallet'
                )} and ensure your desired OPTED-IN wallet is **default** so it can receive the ${
                    this.assetName
                } token.`
            );
            return;
        }
        if (userAsset == 0) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `You don't have any ${this.assetName} to claim!`
            );
            return;
        }
        let claimAsset = await this.checkStdAsset(interaction);
        if (claimAsset) {
            let buttonRow = yesNoButtons('claim');
            const message = await interaction.followUp({
                components: [buttonRow],
                content: `__**Are you sure you want to claim ${userAsset.toLocaleString()} ${
                    this.assetName
                }?**__\n _This will be sent to your designated wallet:_\n ${ObjectUtil.ellipseAddress(
                    rxWallet?.walletAddress
                )}`,
            });
            let claimEmbed = new EmbedBuilder();
            let claimEmbedButton = new ActionRowBuilder<MessageActionRowComponentBuilder>();
            claimEmbed.setTitle(`Claim ${this.assetName}`);
            claimEmbed.setDescription(`There was an error claiming your ${this.assetName}`);

            const collector = message.createMessageComponentCollector();
            collector.on('collect', async (collectInteraction: ButtonInteraction) => {
                await collectInteraction.deferUpdate();
                await collectInteraction.editReply({ components: [] });

                if (collectInteraction.customId.includes('yes')) {
                    await collectInteraction.editReply({
                        content: `Claiming ${userAsset.toLocaleString()} ${this.assetName}...`,
                    });
                    // Create claim response embed

                    await em.getRepository(AlgoTxn).addPendingTxn(caller.id, userAsset);
                    let claimStatus = await this.algorand.claimToken(
                        claimAsset.assetIndex,
                        userAsset,
                        rxWallet.walletAddress
                    );
                    // Clear users asset balance
                    await em.getRepository(User).zeroKarma(caller.id);
                    if (claimStatus.txId) {
                        logger.info(
                            `Claimed ${claimStatus.status?.txn.txn.aamt} ${this.assetName} for ${caller.user.username} (${caller.id})`
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
                        await em
                            .getRepository(AlgoTxn)
                            .addTxn(caller.id, txnTypes.CLAIM, claimStatus);
                        await em.getRepository(User).syncUserWallets(caller.id);
                        claimKarmaWebHook(
                            caller,
                            claimStatus.status?.txn.txn.aamt.toLocaleString(),
                            `https://algoexplorer.io/tx/${claimStatus.txId}`
                        );
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
    @Category('Karma')
    @Slash({
        description: 'Shop at the Karma Store',
        name: 'shop',
    })
    @SlashGroup('karma')
    @Guard(NotBot, BotOwnerOnly)
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
    async claimArtifact(
        interaction: ButtonInteraction,
        caller: GuildMember
    ): Promise<AlgorandPlugin.ClaimTokenResponse> {
        // Get the users RX wallet
        const em = this.orm.em.fork();
        const userDb = em.getRepository(User);
        const rxWallet = await userDb.getRXWallet(caller.id);

        let claimAsset = await this.checkStdAsset(interaction);
        await em.getRepository(AlgoTxn).addPendingTxn(caller.id, this.artifactCost);
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
            await em.getRepository(User).incrementUserArtifacts(caller.id);
            await em.getRepository(User).syncUserWallets(caller.id);
            await em.getRepository(AlgoTxn).addTxn(caller.id, txnTypes.ARTIFACT, claimStatus);
        }
        return claimStatus;
    }
    async shopEmbed(discordUserId: string): Promise<{
        shopEmbed: EmbedBuilder;
        shopButtonRow: ActionRowBuilder<MessageActionRowComponentBuilder>;
    }> {
        const { user, userClaimedKarma } = await this.userAndClaimedKarma(discordUserId);
        // Get unclaimed karma
        const userUnclaimedKarma = user.karma;

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
    async userAndClaimedKarma(discordUserId: string): Promise<{
        user: Loaded<User, never>;
        userClaimedKarma: number;
    }> {
        const em = this.orm.em.fork();
        const userDb = em.getRepository(User);
        const rxWallet = await userDb.getRXWallet(discordUserId);
        const user = await userDb.getUserById(discordUserId);

        // Get Karma from Wallet
        const userWallet = em.getRepository(AlgoWallet);
        const userClaimedKarma = await userWallet.getStdTokenByAssetUnitName(
            rxWallet,
            this.assetType
        );
        return { user, userClaimedKarma };
    }
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
