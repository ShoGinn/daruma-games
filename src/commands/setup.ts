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
import { injectable } from 'tsyringe';

import { AlgoStdAsset } from '../entities/algo-std-asset.entity.js';
import { AlgoWallet } from '../entities/algo-wallet.entity.js';
import { User } from '../entities/user.entity.js';
import { InternalUserIDs, internalUsernames } from '../enums/daruma-training.js';
import { BotOwnerOnly } from '../guards/bot-owner-only.js';
import { GameAssets } from '../model/logic/game-assets.js';
import { Algorand } from '../services/algorand.js';
import { buildAddRemoveButtons } from '../utils/functions/algo-embeds.js';
import logger from '../utils/functions/logger-factory.js';
import { InteractionUtils } from '../utils/utils.js';

@Discord()
@injectable()
@Category('Developer')
@Guard(BotOwnerOnly)
export default class SetupCommand {
    constructor(
        private algoRepo: Algorand,
        private orm: MikroORM,
        private gameAssets: GameAssets
    ) {}
    private buttonFunctionNames = {
        creatorWallet: 'creatorWalletButton',
        reservedWallet: 'reservedWalletButton',
        addStd: 'addStd',
    };
    private getInternalUserName(internalUser: InternalUserIDs): string {
        const userString = internalUsernames[internalUser];
        if (!userString) {
            throw new Error(`Internal User ID ${internalUser} not found`);
        }
        return userString;
    }
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
        setTimeout(() => {
            interaction
                .editReply({
                    embeds: [],
                    components: [],
                    content: 'Timed-Out: Re-Run Setup Again if you need to configure more.',
                })
                .catch(() => null);
        }, 30_000);
    }
    setupButtons = (): ActionRowBuilder<MessageActionRowComponentBuilder> => {
        const creatorWallet = new ButtonBuilder()
            .setCustomId(`creatorWallet`)
            .setLabel('Manage Creator Wallets')
            .setStyle(ButtonStyle.Primary);
        const reservedWallet = new ButtonBuilder()
            .setCustomId(`reservedWallet`)
            .setLabel('Manage Reserved Wallets')
            .setStyle(ButtonStyle.Primary);
        const stdAsset = new ButtonBuilder()
            .setCustomId(`stdAsset`)
            .setLabel('Manage Standard Assets')
            .setStyle(ButtonStyle.Primary);

        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            creatorWallet,
            reservedWallet,
            stdAsset
        );
    };
    @ButtonComponent({ id: 'creatorWallet' })
    async creatorWalletButton(interaction: ButtonInteraction): Promise<void> {
        await this.setupWalletButtons(interaction, InternalUserIDs.creator);
    }
    @ButtonComponent({ id: 'reservedWallet' })
    async reservedWalletButton(interaction: ButtonInteraction): Promise<void> {
        await this.setupWalletButtons(interaction, InternalUserIDs.reserved);
    }
    async setupWalletButtons(
        interaction: ButtonInteraction,
        internalUser: InternalUserIDs
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const walletType = this.getInternalUserName(internalUser);
        const em = this.orm.em.fork();
        let wallets: AlgoWallet[];
        let buttonName: string;
        if (internalUser === InternalUserIDs.creator) {
            wallets = await em.getRepository(AlgoWallet).getCreatorWallets();
            buttonName = this.buttonFunctionNames.creatorWallet;
        } else if (internalUser === InternalUserIDs.reserved) {
            wallets = await em.getRepository(AlgoWallet).getReservedWallets();
            buttonName = this.buttonFunctionNames.reservedWallet;
        } else {
            throw new Error('Invalid Internal User ID');
        }
        const embedsObject: Array<BaseMessageOptions> = [];
        wallets.map((wallet, index) => {
            const embed = new EmbedBuilder().setTitle(`${walletType} Wallets`);
            embed.addFields({ name: `Wallet ${index + 1}`, value: wallet.address });
            const buttonRow = buildAddRemoveButtons(wallet.address, buttonName, wallets.length > 1);
            embedsObject.push({
                embeds: [embed],
                components: [buttonRow],
            });
        });
        if (wallets.length <= 1) {
            const defaultEmbed = new EmbedBuilder().setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
            });
            if (wallets.length === 0) {
                const noWalletsEmbed = {
                    embeds: [
                        defaultEmbed
                            .setTitle(`No ${walletType} Wallets`)
                            .setDescription(
                                `Add a ${walletType} wallet by hitting the plus sign below!`
                            ),
                    ],
                    components: [buildAddRemoveButtons('newOnly', buttonName, false)],
                };
                await InteractionUtils.replyOrFollowUp(interaction, noWalletsEmbed);
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
                time: 30_000,
            }
        );
        await pagination.send();
    }

    @ButtonComponent({ id: /((simple-add-creatorWalletButton_)\S*)\b/gm })
    async addCreatorWalletButton(interaction: ButtonInteraction): Promise<void> {
        await this.addWallet(interaction, InternalUserIDs.creator);
    }
    @ButtonComponent({ id: /((simple-add-reservedWalletButton_)\S*)\b/gm })
    async addReservedWalletButton(interaction: ButtonInteraction): Promise<void> {
        await this.addWallet(interaction, InternalUserIDs.reserved);
    }
    async addWallet(interaction: ButtonInteraction, internalUser: InternalUserIDs): Promise<void> {
        const walletType = this.getInternalUserName(internalUser);

        // Create the modal
        const modal = new ModalBuilder()
            .setTitle(`Add an ${walletType} Algorand Wallet`)
            .setCustomId(`add${walletType}WalletModal`);
        // Create text input fields
        const newWallet = new TextInputBuilder()
            .setCustomId(`new-wallet`)
            .setLabel(`${walletType} Wallet Address`)
            .setStyle(TextInputStyle.Short);
        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newWallet);
        // Add action rows to form
        modal.addComponents(row1);
        // Present the modal to the user
        await interaction.showModal(modal);
    }
    @ModalComponent()
    async addCreatorWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
        await this.addWalletModal(interaction, InternalUserIDs.creator);
    }
    @ModalComponent()
    async addReservedWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
        await this.addWalletModal(interaction, InternalUserIDs.reserved);
    }
    async addWalletModal(
        interaction: ModalSubmitInteraction,
        internalUser: InternalUserIDs
    ): Promise<void> {
        const newWallet = interaction.fields.getTextInputValue('new-wallet');
        const walletType = this.getInternalUserName(internalUser);
        await interaction.deferReply({ ephemeral: true });
        if (!this.algoRepo.validateWalletAddress(newWallet)) {
            await InteractionUtils.replyOrFollowUp(interaction, 'Invalid Wallet Address');
            return;
        }
        // Add Creator wallet to the database
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Adding ${walletType} Wallet.. this may take a while`
        );
        const em = this.orm.em.fork();
        let createdWallet: AlgoWallet | null;
        if (internalUser === InternalUserIDs.creator) {
            createdWallet = await em.getRepository(AlgoWallet).addCreatorWallet(newWallet);
        } else if (internalUser === InternalUserIDs.reserved) {
            createdWallet = await em.getRepository(AlgoWallet).addReservedWallet(newWallet);
        } else {
            throw new Error('Invalid Internal User ID');
        }
        await (createdWallet
            ? interaction.editReply(
                  `Added ${walletType} Wallet Address: ${newWallet} to the database`
              )
            : interaction.editReply(
                  `${walletType} Wallet Address: ${newWallet} already exists in the database`
              ));
        return;
    }
    @ButtonComponent({ id: /((simple-remove-creatorWalletButton_)\S*)\b/gm })
    async removeCreatorWalletButton(interaction: ButtonInteraction): Promise<void> {
        await this.removeWallet(interaction, InternalUserIDs.creator);
    }
    @ButtonComponent({ id: /((simple-remove-reservedWalletButton_)\S*)\b/gm })
    async removeReservedWalletButton(interaction: ButtonInteraction): Promise<void> {
        await this.removeWallet(interaction, InternalUserIDs.reserved);
    }
    async removeWallet(
        interaction: ButtonInteraction,
        internalUser: InternalUserIDs
    ): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const address = interaction.customId.split('_')[1];
        if (!address) {
            throw new Error('No address found');
        }
        const em = this.orm.em.fork();
        if (internalUser === InternalUserIDs.creator) {
            await em.getRepository(AlgoWallet).removeCreatorWallet(address);
        } else if (internalUser === InternalUserIDs.reserved) {
            await em.getRepository(AlgoWallet).removeReservedWallet(address);
        }
        const message = `Removed wallet ${address}`;
        await InteractionUtils.replyOrFollowUp(interaction, message);
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
            embed.addFields(
                {
                    name: `Asset ${index + 1}`,
                    value: asset.name,
                },
                { name: 'Asset ID', value: asset.id.toString(), inline: true },
                { name: 'Asset Name', value: asset.name, inline: true },
                { name: 'Asset Unit-Name', value: asset.unitName, inline: true }
            );
            const buttonRow = buildAddRemoveButtons(
                asset.id.toString(),
                this.buttonFunctionNames.addStd,
                stdAssets.length > 1
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
                const noAssetsEmbed = {
                    embeds: [
                        defaultEmbed
                            .setTitle('No standard assets')
                            .setDescription('Add a standard asset by hitting the plus sign below!'),
                    ],
                    components: [
                        buildAddRemoveButtons('newOnly', this.buttonFunctionNames.addStd, false),
                    ],
                };
                await InteractionUtils.replyOrFollowUp(interaction, noAssetsEmbed);
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
                time: 30_000,
            }
        );
        await pagination.send();
    }

    @ButtonComponent({ id: /((simple-add-addStd_)\S*)\b/gm })
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
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `Standard Asset with ID: ${newAsset} already exists in the database`
            );
            return;
        }
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Checking ${newAsset}... this may take a while`
        );
        const stdAsset = await this.algoRepo.lookupAssetByIndex(newAsset);
        if (stdAsset.asset.deleted == false) {
            await InteractionUtils.replyOrFollowUp(interaction, {
                content: `ASA's found: ${newAsset}\n ${stdAsset.asset.params.name ?? 'unk'}`,
                ephemeral: true,
            });
            await em.getRepository(AlgoStdAsset).addAlgoStdAsset(stdAsset);
            if (!this.gameAssets.isReady()) {
                logger.info('Running the Game Asset Init');
                await this.gameAssets.initAll();
            }

            await this.userAssetSync();
            return;
        }
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: `No ASA's found for index: ${newAsset}`,
            ephemeral: true,
        });
    }
    @ButtonComponent({ id: /((simple-remove-addStd_)\S*)\b/gm })
    async removeStdAsset(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const address = interaction.customId.split('_')[1];
        const em = this.orm.em.fork();
        const stdAssetExists = await em.getRepository(AlgoStdAsset).doesAssetExist(Number(address));
        if (!stdAssetExists) {
            await InteractionUtils.replyOrFollowUp(
                interaction,
                `Standard Asset with ID: ${address} doesn't exists in the database`
            );
            return;
        }
        await InteractionUtils.replyOrFollowUp(
            interaction,
            `Deleting Address: ${address} for ASA's...`
        );
        await em.getRepository(AlgoStdAsset).deleteStdAsset(Number(address));
        await this.userAssetSync();
        await InteractionUtils.replyOrFollowUp(interaction, {
            content: `ASA's deleted for Wallet Address: ${address}`,
            ephemeral: true,
        });
    }
    async userAssetSync(): Promise<void> {
        const em = this.orm.em.fork();
        await em.getRepository(User).userAssetSync();
    }
}
