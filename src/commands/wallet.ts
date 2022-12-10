import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import {
    ActionRowBuilder,
    APIEmbedField,
    ApplicationCommandType,
    ButtonInteraction,
    CommandInteraction,
    User as DiscordUser,
    EmbedBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
    UserContextMenuCommandInteraction,
} from 'discord.js';
import type { BaseMessageOptions } from 'discord.js';
import { ButtonComponent, ContextMenu, Discord, Guard, ModalComponent, Slash } from 'discordx';
import { injectable } from 'tsyringe';

import { Disabled } from '../guards/disabled.js';
import { Maintenance } from '../guards/maintenance.js';
import { addRemoveButtons, customButton, defaultButton } from '../utils/functions/algoEmbeds.js';
import { paginatedDarumaEmbed } from '../utils/functions/dtEmbeds.js';

@Discord()
@injectable()
@Category('Daruma Wallet')
export default class WalletCommand {
    constructor(private algoRepo: Algorand, private db: Database) {}
    /**
     *Admin Command to Sync User Wallets
     *
     * @param {UserContextMenuCommandInteraction} interaction
     * @memberof WalletCommand
     */
    @ContextMenu({
        name: 'Sync User Wallet',
        type: ApplicationCommandType.User,
    })
    @Guard(Disabled, PermissionGuard(['Administrator']))
    async userSync(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply(`Syncing User @${interaction.targetUser.username} Wallets...`);
        const msg = await this.db.get(User).syncUserWallets(interaction.targetId);
        await interaction.editReply(msg);
    }

    /**
     *Admin Command to Sync Creator Assets
     *
     * @param {UserContextMenuCommandInteraction} interaction
     * @memberof WalletCommand
     */
    @ContextMenu({
        name: 'Sync Creator Assets',
        type: ApplicationCommandType.User,
    })
    @Guard(Disabled, PermissionGuard(['Administrator']))
    async creatorAssetSync(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply(`Forcing an Out of Cycle Creator Asset Sync...`);
        const msg = await this.algoRepo.creatorAssetSync();
        await interaction.editReply(msg);
    }
    @ContextMenu({
        name: 'Sync All User Assets',
        type: ApplicationCommandType.User,
    })
    @Guard(Disabled, PermissionGuard(['Administrator']))
    async syncAllUserAssets(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply(`Forcing an Out of Cycle User Asset Sync...`);
        const msg = await this.algoRepo.userAssetSync();
        await interaction.editReply(msg);
    }

    @ContextMenu({
        name: 'Clear All CD`s',
        type: ApplicationCommandType.User,
    })
    @Guard(Disabled, PermissionGuard(['Administrator']))
    async userCoolDownClear(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.editReply(
            `Clearing all the cool downs for all @${interaction.targetUser.username} assets...`
        );
        await this.db.get(AlgoWallet).clearAllDiscordUserAssetCoolDowns(interaction.targetId);
        await interaction.editReply('All cool downs cleared');
    }

    @Slash({ name: 'wallet', description: 'Manage Algorand Wallets and Daruma' })
    @Guard(Maintenance)
    @Guard(RateLimit(TIME_UNIT.seconds, 10))
    async wallet(interaction: CommandInteraction): Promise<void> {
        const discordUser = resolveUser(interaction)?.id ?? ' ';
        await this.sendWalletEmbeds({ interaction, discordUser });
    }

    @ButtonComponent({ id: /((simple-remove-userWallet_)[^\s]*)\b/gm })
    async removeWallet(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const discordUser = resolveUser(interaction)?.id ?? ' ';
        const address = interaction.customId.split('_')[1];
        let msg = await this.db.get(User).removeWalletFromUser(discordUser, address);
        await interaction.editReply(msg);
    }
    @ButtonComponent({ id: /((default-button_)[^\s]*)\b/gm })
    async defaultWallet(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const discordUser = resolveUser(interaction)?.id ?? ' ';
        const address = interaction.customId.split('_')[1];
        await this.db.get(User).setRxWallet(discordUser, address);
        await interaction.editReply(`Default wallet set to ${ellipseAddress(address)}`);
    }

    @ButtonComponent({ id: /((simple-add-userWallet_)[^\s]*)\b/gm })
    async addWallet(interaction: ButtonInteraction): Promise<void> {
        // Create the modal
        const modal = new ModalBuilder()
            .setTitle('Add an Algorand Wallet')
            .setCustomId('addWalletModal');
        // Create text input fields
        const newWallet = new TextInputBuilder()
            .setCustomId('new-wallet')
            .setLabel('Wallet Address')
            .setStyle(TextInputStyle.Short);
        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newWallet);
        // Add action rows to form
        modal.addComponents(row1);
        // Present the modal to the user
        await interaction.showModal(modal);
    }
    @ModalComponent()
    async addWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
        const newWallet = interaction.fields.getTextInputValue('new-wallet');
        await interaction.deferReply({ ephemeral: true });
        if (!this.algoRepo.validateWalletAddress(newWallet)) {
            await interaction.editReply('Invalid Wallet Address');
            return;
        }
        const discordUser = resolveUser(interaction)?.id ?? ' ';
        const msg = await this.db.get(User).addWalletAndSyncAssets(discordUser, newWallet);
        await interaction.editReply(msg);
        return;
    }

    private async sendWalletEmbeds({
        interaction,
        discordUser,
    }: {
        interaction: CommandInteraction | ButtonInteraction;
        discordUser: string;
    }): Promise<void> {
        // specific embed
        const wallets = (await this.db.get(AlgoWallet).getAllWalletsByDiscordId(discordUser)) ?? [];
        const totalUserAssets = await this.db
            .get(AlgoWallet)
            .getTotalAssetsByDiscordUser(discordUser);
        const lastUpdated = timeAgo(await this.db.get(AlgoWallet).lastUpdatedDate(discordUser));

        const maxPage = wallets.length > 0 ? wallets.length : 1;
        let embedsObject: BaseMessageOptions[] = [];
        for (let i = 0; i < wallets.length; i++) {
            let embed = await this.getWalletEmbed({
                currentWallet: wallets[i],
                user: interaction.user,
            });
            embed.setTitle('Owned Wallets');
            embed.setDescription(`**${wallets.length}** 📁 • ${totalUserAssets} assets`);
            embed.setFooter({
                text: `Wallet ${i + 1} of ${maxPage} ` + `• Sync'd: ${lastUpdated}`,
            });

            let buttonRow = addRemoveButtons(
                wallets[i].walletAddress,
                'userWallet',
                wallets[i].rxWallet
            );
            if (!wallets[i].rxWallet) {
                buttonRow.addComponents(defaultButton(wallets[i].walletAddress));
            }
            buttonRow.addComponents(customButton(discordUser, 'Customize your Daruma'));
            embedsObject.push({
                embeds: [embed],
                components: [buttonRow],
            });
        }
        if (wallets.length <= 1) {
            const defaultEmbed = new EmbedBuilder().setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
            });
            if (wallets.length === 0) {
                embedsObject.push({
                    embeds: [
                        defaultEmbed
                            .setTitle('No Wallets')
                            .setDescription('Add a wallet by hitting the plus sign below!'),
                    ],
                    components: [addRemoveButtons('newOnly', 'userWallet', true)],
                });
                await interaction.editReply(embedsObject[0]);
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
    private async getWalletEmbed({
        currentWallet,
        user,
    }: {
        currentWallet: AlgoWallet;
        user: DiscordUser;
    }): Promise<EmbedBuilder> {
        const embed = new EmbedBuilder()
            .setThumbnail(
                await this.db.get(AlgoWallet).getRandomImageUrl(currentWallet.walletAddress)
            )
            .setAuthor({
                name: user.username,
                iconURL: user.displayAvatarURL({ forceStatic: false }),
            });

        const walletTokens = await this.db
            .get(AlgoWallet)
            .getWalletTokens(currentWallet.walletAddress);

        let tokenFields: APIEmbedField[] = [];
        for (const token of walletTokens) {
            await token.algoStdTokenType.init();
            tokenFields.push({
                name: token.algoStdTokenType[0]?.name ?? 'Unknown',
                value: token.tokens?.toLocaleString() ?? '0',
            });
        }
        let defRX = '\u200b';
        if (currentWallet.rxWallet) {
            defRX = '__This wallet will be used to receive any Tokens__';
        }

        embed.addFields([
            {
                name: defRX,
                value: currentWallet.walletAddress,
                inline: false,
            },
            ...tokenFields,
        ]);

        return embed;
    }

    @Guard(Maintenance)
    @ButtonComponent({ id: /((custom-button_)[^\s]*)\b/gm })
    async customizedDaruma(interaction: ButtonInteraction): Promise<void> {
        await paginatedDarumaEmbed(interaction);
    }

    @ButtonComponent({ id: /((daruma-edit-alias_)[^\s]*)\b/gm })
    async editDarumaBtn(interaction: ButtonInteraction): Promise<void> {
        // Create the modal
        const assetId = interaction.customId.split('_')[1];
        const db = await resolveDependency(Database);
        const asset = await db.get(AlgoNFTAsset).findOneOrFail({ assetIndex: Number(assetId) });
        const modal = new ModalBuilder()
            .setTitle(`Customize your Daruma`)
            .setCustomId(`daruma-edit-alias-modal_${assetId}`);
        // Create text input fields
        const newAlias = new TextInputBuilder()
            .setCustomId(`new-alias`)
            .setLabel(`Custom Daruma Name`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(asset.name);
        if (asset.alias) {
            newAlias.setValue(asset.alias);
        }
        const newBattleCry = new TextInputBuilder()
            .setCustomId(`new-battle-cry`)
            .setLabel(`Your Flex Battle Cry (optional)`)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false);
        if (asset.assetNote?.battleCry) {
            newBattleCry.setValue(asset.assetNote.battleCry);
        }
        const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newAlias);
        const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(newBattleCry);

        // Add action rows to form
        modal.addComponents(row1, row2);
        // Present the modal to the user
        await interaction.showModal(modal);
    }
    @ModalComponent({ id: /((daruma-edit-alias-modal_)[^\s]*)\b/gm })
    async editDarumaModal(interaction: ModalSubmitInteraction): Promise<void> {
        const newAlias = interaction.fields.getTextInputValue('new-alias');
        const newBattleCry = interaction.fields.getTextInputValue('new-battle-cry');
        const assetId = interaction.customId.split('_')[1];
        const db = await resolveDependency(Database);
        const asset = await db.get(AlgoNFTAsset).findOneOrFail({ assetIndex: Number(assetId) });
        // Set the new alias
        asset.alias = newAlias;
        let battleCryUpdatedMsg = '';
        if (asset.assetNote && newBattleCry) {
            asset.assetNote.battleCry = newBattleCry;
            battleCryUpdatedMsg = 'Your battle cry has been updated! to: ' + newBattleCry;
        }
        await db.get(AlgoNFTAsset).persistAndFlush(asset);
        await interaction.deferReply({ ephemeral: true, fetchReply: true });
        await interaction.followUp(
            `We have updated Daruma ${asset.name} to ${newAlias}\n${battleCryUpdatedMsg}`
        );
        return;
    }
}
