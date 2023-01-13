import InteractionUtils = DiscordUtils.InteractionUtils;
import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { MikroORM } from '@mikro-orm/core';
import {
    ActionRowBuilder,
    APIEmbedField,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    CommandInteraction,
    User as DiscordUser,
    EmbedBuilder,
    inlineCode,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
    UserContextMenuCommandInteraction,
} from 'discord.js';
import type { BaseMessageOptions } from 'discord.js';
import { ButtonComponent, ContextMenu, Discord, Guard, ModalComponent, Slash } from 'discordx';
import { container, injectable } from 'tsyringe';

import { AlgoNFTAsset } from '../entities/AlgoNFTAsset.js';
import { AlgoStdToken } from '../entities/AlgoStdToken.js';
import { AlgoWallet } from '../entities/AlgoWallet.js';
import { User } from '../entities/User.js';
import { NFDomainsManager } from '../model/framework/manager/NFDomains.js';
import { Algorand } from '../services/Algorand.js';
import { CustomCache } from '../services/CustomCache.js';
import { addRemoveButtons, customButton } from '../utils/functions/algoEmbeds.js';
import { paginatedDarumaEmbed } from '../utils/functions/dtEmbeds.js';
import { DiscordUtils, ObjectUtil } from '../utils/Utils.js';

@Discord()
@injectable()
@Category('Wallet')
export default class WalletCommand {
    constructor(private algoRepo: Algorand, private orm: MikroORM) {}
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
    @Guard(PermissionGuard(['Administrator']))
    async userSync(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await interaction.followUp(`Syncing User @${interaction.targetUser.username} Wallets...`);
        const em = this.orm.em;
        const msg = await em.getRepository(User).syncUserWallets(interaction.targetId);
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
    @Guard(PermissionGuard(['Administrator']))
    async creatorAssetSync(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await interaction.followUp(`Forcing an Out of Cycle Creator Asset Sync...`);
        const msg = await this.algoRepo.creatorAssetSync();
        await interaction.editReply(msg);
    }

    @ContextMenu({
        name: 'Clear User CD`s',
        type: ApplicationCommandType.User,
    })
    @Guard(PermissionGuard(['Administrator']))
    async userCoolDownClear(interaction: UserContextMenuCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        await interaction.followUp(
            `Clearing all the cool downs for all @${interaction.targetUser.username} assets...`
        );
        const em = this.orm.em;
        await em.getRepository(AlgoWallet).clearAllDiscordUserAssetCoolDowns(interaction.targetId);
        await interaction.editReply('All cool downs cleared');
    }

    @Slash({ name: 'wallet', description: 'Manage Algorand Wallets and Daruma' })
    @Guard(RateLimit(TIME_UNIT.seconds, 10))
    async wallet(interaction: CommandInteraction): Promise<void> {
        const discordUser = interaction.user.id;
        await this.sendWalletEmbeds({ interaction, discordUser });
    }

    @ButtonComponent({ id: /((simple-remove-userWallet_)[^\s]*)\b/gm })
    async removeWallet(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true });
        const discordUser = interaction.user.id;
        const address = interaction.customId.split('_')[1];
        const em = this.orm.em;
        const msg = await em.getRepository(User).removeWalletFromUser(discordUser, address);
        await InteractionUtils.replyOrFollowUp(interaction, msg);
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
        const discordUser = interaction.user.id;
        const em = this.orm.em;
        const msg = await em.getRepository(User).addWalletAndSyncAssets(discordUser, newWallet);
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
        await interaction.deferReply({ ephemeral: true });
        // specific embed
        const em = this.orm.em;
        const cache = container.resolve(CustomCache);
        const walletSyncCache = cache.get(`${interaction.user.id}_wallet_refresh`);
        const wallets =
            (await em.getRepository(AlgoWallet).getAllWalletsByDiscordId(discordUser)) ?? [];
        const totalUserAssets = await em
            .getRepository(AlgoWallet)
            .getTotalAssetsByDiscordUser(discordUser);
        const lastUpdated = ObjectUtil.timeAgo(
            await em.getRepository(AlgoWallet).lastUpdatedDate(discordUser)
        );

        const maxPage = wallets.length > 0 ? wallets.length : 1;
        const embedsObject: BaseMessageOptions[] = [];
        for (let i = 0; i < wallets.length; i++) {
            const { embed } = await this.getWalletEmbed({
                currentWallet: wallets[i],
                user: interaction.user,
            });
            embed.setTitle('Owned Wallets');
            embed.setDescription(`**${wallets.length}** 📁 • ${totalUserAssets} assets`);
            embed.setFooter({
                text: `Wallet ${i + 1} of ${maxPage} • Sync'd: ${lastUpdated}`,
            });

            const buttonRow = addRemoveButtons(
                wallets[i].address,
                'userWallet',
                wallets.length === 1
            );
            const customizeDaruma = customButton(discordUser, 'Customize your Daruma');
            if (totalUserAssets > 0) {
                buttonRow.addComponents(customizeDaruma);
            }
            const walletSyncButton = new ButtonBuilder()
                .setCustomId('sync-userWallet')
                .setLabel('Sync Wallet With Algorand Chain')
                .setStyle(ButtonStyle.Primary);

            if (walletSyncCache) {
                walletSyncButton.setDisabled(true);
            }
            buttonRow.addComponents(walletSyncButton);
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
    private async getWalletEmbed({
        currentWallet,
        user,
    }: {
        currentWallet: AlgoWallet;
        user: DiscordUser;
    }): Promise<{
        embed: EmbedBuilder;
        walletTokens: AlgoStdToken[];
    }> {
        const em = this.orm.em;
        const embed = new EmbedBuilder()
            .setThumbnail(
                await em.getRepository(AlgoWallet).getRandomImageUrl(currentWallet.address)
            )
            .setAuthor({
                name: user.username,
                iconURL: user.displayAvatarURL({ forceStatic: false }),
            });

        const walletTokens = await em
            .getRepository(AlgoWallet)
            .getWalletTokens(currentWallet.address);

        const tokenFields: APIEmbedField[] = [];
        for (const token of walletTokens) {
            await token.asa.init();
            const claimedTokens = token.tokens?.toLocaleString() ?? '0';
            const unclaimedtokens = token.unclaimedTokens?.toLocaleString() ?? '0';
            const optedIn = token.optedIn ? '✅' : '❌';
            const tokenName = token.asa[0]?.name ?? 'Unknown';
            tokenFields.push({
                name: `${tokenName} (${token.asa[0]?.id})`,
                value: `Claimed: ${inlineCode(claimedTokens)} \nUnclaimed: ${inlineCode(
                    unclaimedtokens
                )} \nOpted In: ${optedIn}`,
            });
        }
        const nfDomainsMgr = container.resolve(NFDomainsManager);
        const nfDomain = await nfDomainsMgr.getWalletDomainNamesFromWallet(currentWallet.address);
        let nfDomainString = '';
        // join the array of domains into a string and add currentWallet.address to the end
        nfDomainString =
            nfDomain.length > 0
                ? `${inlineCode(nfDomain.join(', '))} ${currentWallet.address}`
                : inlineCode(currentWallet.address);
        embed.addFields([
            {
                name: 'Wallet Address',
                value: nfDomainString,
                inline: false,
            },
            ...tokenFields,
        ]);

        return { embed, walletTokens };
    }

    @ButtonComponent({ id: /((custom-button_)[^\s]*)\b/gm })
    async customizedDaruma(interaction: ButtonInteraction): Promise<void> {
        await paginatedDarumaEmbed(interaction);
    }
    @ButtonComponent({ id: 'sync-userWallet' })
    async userSyncWallet(interaction: ButtonInteraction): Promise<void> {
        await interaction.deferReply();
        const em = this.orm.em;
        const cache = container.resolve(CustomCache);
        const walletRefreshId = `${interaction.user.id}_wallet_refresh`;
        if (cache.get(walletRefreshId)) {
            await interaction.editReply(
                `You have already synced your wallets in the last 6 hours. Please try again later.`
            );
            return;
        }
        // 6 hours in seconds = 21600
        cache.set(walletRefreshId, true, 21_600);

        const msg = await em.getRepository(User).syncUserWallets(interaction.user.id);
        await interaction.editReply(msg);
    }

    @ButtonComponent({ id: /((daruma-edit-alias_)[^\s]*)\b/gm })
    async editDarumaBtn(interaction: ButtonInteraction): Promise<void> {
        // Create the modal
        const assetId = interaction.customId.split('_')[1];
        const em = this.orm.em;
        const asset = await em.getRepository(AlgoNFTAsset).findOneOrFail({ id: Number(assetId) });
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
        if (asset.note?.battleCry) {
            newBattleCry.setValue(asset.note.battleCry);
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
        const em = this.orm.em;
        const asset = await em.getRepository(AlgoNFTAsset).findOneOrFail({ id: Number(assetId) });
        // Set the new alias
        asset.alias = newAlias;
        let battleCryUpdatedMsg = '';
        if (asset.note && newBattleCry) {
            asset.note.battleCry = newBattleCry;
            battleCryUpdatedMsg = `Your battle cry has been updated! to: ${newBattleCry}`;
        }
        await em.getRepository(AlgoNFTAsset).persistAndFlush(asset);
        await interaction.deferReply({ ephemeral: true, fetchReply: true });
        await interaction.followUp(
            `We have updated Daruma ${asset.name} to ${newAlias}\n${battleCryUpdatedMsg}`
        );
        return;
    }
}
