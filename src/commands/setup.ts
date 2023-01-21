import InteractionUtils = DiscordUtils.InteractionUtils;
import { Pagination, PaginationType } from '@discordx/pagination';
import { Category } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
    ActionRowBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CommandInteraction,
    EmbedBuilder,
    MessageActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { ButtonComponent, Discord, Guard, ModalComponent, Slash, SlashGroup } from 'discordx';
import { container, injectable } from 'tsyringe';

import { AlgoStdAsset } from '../entities/AlgoStdAsset.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { BotOwnerOnly } from '../guards/BotOwnerOnly.js';
import { Algorand } from '../services/Algorand.js';
import { addRemoveButtons } from '../utils/functions/algoEmbeds.js';
import { DiscordUtils } from '../utils/Utils.js';

@Discord()
@injectable()
@Category('Developer')
@Guard(BotOwnerOnly)
export default class SetupCommand {
    constructor(private algoRepo: Algorand, private orm: MikroORM) {}
    private buttonFunctionNames = {
        creatorWallet: 'creatorWalletButton',
        addStd: 'addStd',
    };
    @Slash({ name: 'setup', description: 'Setup The Bot' })
    @SlashGroup('dev')
    async setup(interaction: CommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const embed = new EmbedBuilder()
            .setTitle('Setup')
            .setDescription('Use the buttons below to setup the bot');
        await InteractionUtils.replyOrFollowUp(interaction, {
            embeds: [embed],
            components: [this.setupButtons()],
        });
        setTimeout(
            inx =>
                inx.editReply({
                    embeds: [],
                    components: [],
                    content: 'Timed-Out: Re-Run Setup Again if you need to configure more.',
                }),
            30 * 1000,
            interaction
        );
    }
    setupButtons = (): ActionRowBuilder<MessageActionRowComponentBuilder> => {
        const creatorWallet = new ButtonBuilder()
            .setCustomId(`creatorWallet`)
            .setLabel('Manage Creator Wallets')
            .setStyle(ButtonStyle.Primary);

        const stdAsset = new ButtonBuilder()
            .setCustomId(`stdAsset`)
            .setLabel('Manage Standard Assets')
            .setStyle(ButtonStyle.Primary);

        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            creatorWallet,
            stdAsset
        );
    };
    @ButtonComponent({ id: 'creatorWallet' })
    async creatorWalletButton(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const creatorWallets = await em.getRepository(AlgoWallet).getCreatorWallets();
        const embedsObject: Array<BaseMessageOptions> = [];
        creatorWallets.map((wallet, i) => {
            const embed = new EmbedBuilder().setTitle('Creator Wallets');
            embed.addFields({ name: `Wallet ${i + 1}`, value: wallet.address });
            const buttonRow = addRemoveButtons(
                wallet.address,
                this.buttonFunctionNames.creatorWallet,
                creatorWallets.length < 1
            );
            embedsObject.push({
                embeds: [embed],
                components: [buttonRow],
            });
        });
        if (creatorWallets.length <= 1) {
            const defaultEmbed = new EmbedBuilder().setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
            });
            if (creatorWallets.length === 0) {
                embedsObject.push({
                    embeds: [
                        defaultEmbed
                            .setTitle('No Creator Wallets')
                            .setDescription('Add a creator wallet by hitting the plus sign below!'),
                    ],
                    components: [
                        addRemoveButtons('newOnly', this.buttonFunctionNames.creatorWallet, true),
                    ],
                });
                await InteractionUtils.replyOrFollowUp(interaction, embedsObject[0]);
                return;
            }
        }

        const pagination = new Pagination(
            interaction,
            embedsObject.map(embed => embed),
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

    @ButtonComponent({ id: /((simple-add-creatorWalletButton_)[^\s]*)\b/gm })
    async addWallet(interaction: ButtonInteraction): Promise<void> {
        // Create the modal
        const modal = new ModalBuilder()
            .setTitle('Add an Creators Algorand Wallet')
            .setCustomId('addCreatorWalletModal');
        // Create text input fields
        const newWallet = new TextInputBuilder()
            .setCustomId('new-wallet')
            .setLabel('Creator Wallet Address')
            .setStyle(TextInputStyle.Short);
        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newWallet);
        // Add action rows to form
        modal.addComponents(row1);
        // Present the modal to the user
        await interaction.showModal(modal);
    }
    @ModalComponent()
    async addCreatorWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
        const newWallet = interaction.fields.getTextInputValue('new-wallet');
        await interaction.deferReply({ ephemeral: true });
        if (!this.algoRepo.validateWalletAddress(newWallet)) {
            await InteractionUtils.replyOrFollowUp(interaction, 'Invalid Wallet Address');
            return;
        }
        // Add Creator wallet to the database
        await InteractionUtils.replyOrFollowUp(
            interaction,
            'Adding Creator Wallet.. this may take a while'
        );
        const em = this.orm.em.fork();
        const createdWallet = await em.getRepository(AlgoWallet).addCreatorWallet(newWallet);
        if (createdWallet) {
            InteractionUtils.replyOrFollowUp(
                interaction,
                `Added Creator Wallet Address: ${newWallet} to the database`
            );
        } else {
            InteractionUtils.replyOrFollowUp(
                interaction,
                `Creator Wallet Address: ${newWallet} already exists in the database`
            );
        }
        return;
    }
    @ButtonComponent({ id: /((simple-remove-creatorWalletButton_)[^\s]*)\b/gm })
    async removeWallet(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const address = interaction.customId.split('_')[1];
        const em = this.orm.em.fork();
        await em.getRepository(AlgoWallet).removeCreatorWallet(address);
        const msg = `Removed wallet ${address}`;
        await InteractionUtils.replyOrFollowUp(interaction, msg);
    }

    //*!
    /* Std Asset */
    //*!
    @ButtonComponent({ id: 'stdAsset' })
    async stdAssetWalletButton(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const stdAssets = await em.getRepository(AlgoStdAsset).getAllStdAssets();
        const embedsObject: Array<BaseMessageOptions> = [];
        stdAssets.map((asset, index) => {
            const embed = new EmbedBuilder().setTitle('Standard Assets');
            embed.addFields({
                name: `Asset ${index + 1} - ${asset.name}`,
                value: `${asset.unitName}`,
            });
            const buttonRow = addRemoveButtons(
                asset.id.toString(),
                this.buttonFunctionNames.addStd,
                stdAssets.length < 1
            );
            embedsObject.push({
                embeds: [embed],
                components: [buttonRow],
            });
        });
        if (stdAssets.length <= 1) {
            const defaultEmbed = new EmbedBuilder().setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
            });
            if (stdAssets.length === 0) {
                embedsObject.push({
                    embeds: [
                        defaultEmbed
                            .setTitle('No standard assets')
                            .setDescription('Add a standard asset by hitting the plus sign below!'),
                    ],
                    components: [
                        addRemoveButtons('newOnly', this.buttonFunctionNames.addStd, true),
                    ],
                });
                await InteractionUtils.replyOrFollowUp(interaction, embedsObject[0]);
                return;
            }
        }

        const pagination = new Pagination(
            interaction,
            embedsObject.map(embed => embed),
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

    @ButtonComponent({ id: /((simple-add-addStd_)[^\s]*)\b/gm })
    async addStdAsset(interaction: ButtonInteraction): Promise<void> {
        // Create the modal
        const modal = new ModalBuilder()
            .setTitle('Add an Standard Asset')
            .setCustomId('addStdAssetModal');
        // Create text input fields
        const newAsset = new TextInputBuilder()
            .setCustomId('new-asset')
            .setLabel('Asset ID')
            .setStyle(TextInputStyle.Short);

        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newAsset);
        // Add action rows to form
        modal.addComponents(row1);
        // Present the modal to the user
        await interaction.showModal(modal);
    }
    @ModalComponent()
    async addStdAssetModal(interaction: ModalSubmitInteraction): Promise<void> {
        const newAsset = Number(interaction.fields.getTextInputValue('new-asset'));
        await interaction.deferReply({ ephemeral: true });
        const em = this.orm.em.fork();
        const stdAssetExists = await em.getRepository(AlgoStdAsset).doesAssetExist(newAsset);
        if (stdAssetExists) {
            InteractionUtils.replyOrFollowUp(
                interaction,
                `Standard Asset with ID: ${newAsset} already exists in the database`
            );
            return;
        }
        InteractionUtils.replyOrFollowUp(
            interaction,
            `Checking Wallet Address: ${newAsset} for ASA's...`
        );
        const stdAsset = await this.algoRepo.lookupAssetByIndex(newAsset);
        if (stdAsset.asset.deleted == false) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `ASA's found for Wallet Address: ${newAsset}\n ${stdAsset.asset.params.name}`
            );
            await em.getRepository(AlgoStdAsset).addAlgoStdAsset(stdAsset);
            const algorand = container.resolve(Algorand);
            await algorand.userAssetSync();
            return;
        }
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `No ASA's found for Wallet Address: ${newAsset}`
        );
    }
    @ButtonComponent({ id: /((simple-remove-addStd_)[^\s]*)\b/gm })
    async removeStdAsset(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const address = interaction.customId.split('_')[1];
        const em = this.orm.em.fork();
        const stdAssetExists = await em.getRepository(AlgoStdAsset).doesAssetExist(Number(address));
        if (!stdAssetExists) {
            InteractionUtils.replyOrFollowUp(
                interaction,
                `Standard Asset with ID: ${address} doesn't exists in the database`
            );
            return;
        }
        InteractionUtils.replyOrFollowUp(interaction, `Deleting Address: ${address} for ASA's...`);
        await em.getRepository(AlgoStdAsset).deleteStdAsset(Number(address));
        const algorand = container.resolve(Algorand);
        await algorand.userAssetSync();
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `ASA's deleted for Wallet Address: ${address}`
        );
    }
}
