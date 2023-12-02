import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonInteraction,
  CommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserContextMenuCommandInteraction,
} from 'discord.js';

import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { ButtonComponent, ContextMenu, Discord, Guard, ModalComponent, Slash } from 'discordx';

import { isValidAddress } from 'algosdk';
import { inject, injectable } from 'tsyringe';

import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { UserService } from '../services/user.js';
import { DiscordId, WalletAddress } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { paginatedDarumaEmbed } from '../utils/functions/dt-embeds.js';

import { WalletCommandService } from './wallet.service.js';

@Discord()
@injectable()
@Category('Wallet')
export default class WalletCommand {
  constructor(
    @inject(WalletCommandService) private walletCommandService: WalletCommandService,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(UserService) private userService: UserService,
  ) {}

  @ContextMenu({
    name: 'Clear User CD`s',
    type: ApplicationCommandType.User,
  })
  @Guard(PermissionGuard(['Administrator']))
  async userCoolDownClear(interaction: UserContextMenuCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = await this.walletCommandService.clearUserCoolDowns(
      interaction.user.id as DiscordId,
    );
    await interaction.editReply(embed);
  }
  @Slash({ name: 'uprole', description: 'Not a command' })
  async uprole(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    // provide a response that this is not a server command
    await InteractionUtils.replyOrFollowUp(interaction, {
      content:
        'No need to use this command, the bot will automatically update your role.\nIf you are having issues, open a ticket in the support channel.',
      ephemeral: true,
    });
  }
  @Slash({ name: 'wallet', description: 'Manage Algorand Wallets and Daruma' })
  @Guard(RateLimit(TIME_UNIT.seconds, 10, { ephemeral: true }))
  async wallet(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await this.walletCommandService.paginatedWalletEmbeds(interaction);
  }
  @ButtonComponent({ id: 'walletSetup' })
  async walletSetup(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await this.walletCommandService.paginatedWalletEmbeds(interaction);
  }
  @ButtonComponent({ id: /((simple-remove-userWallet_)\S*)\b/gm })
  async removeWallet(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = await this.walletCommandService.removeWallet(interaction);
    await interaction.editReply(embed);
  }

  @ButtonComponent({ id: /((simple-add-userWallet_)\S*)\b/gm })
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
    const newWallet = interaction.fields.getTextInputValue('new-wallet') as WalletAddress;
    await interaction.deferReply({ ephemeral: true });
    if (!isValidAddress(newWallet)) {
      await interaction.editReply('Invalid Wallet Address');
      return;
    }
    const discordUser = interaction.user.id as DiscordId;
    const message = await this.userService.addWalletToUser(newWallet, discordUser);
    await interaction.editReply(message);
    return;
  }

  @ButtonComponent({ id: /((custom-button_)\S*)\b/gm })
  async customizedDaruma(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await paginatedDarumaEmbed(interaction);
  }

  @ButtonComponent({ id: /((daruma-edit-alias_)\S*)\b/gm })
  async editDarumaBtn(interaction: ButtonInteraction): Promise<void> {
    // Create the modal
    const assetId = interaction.customId.split('_')[1];
    const asset = await this.algoNFTAssetService.getAssetById(Number(assetId));
    if (!asset) {
      throw new Error('No asset found');
    }
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
    if (asset.battleCry) {
      newBattleCry.setValue(asset.battleCry);
    }
    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(newAlias);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(newBattleCry);

    // Add action rows to form
    modal.addComponents(row1, row2);
    // Present the modal to the user
    await interaction.showModal(modal);
  }
  @ModalComponent({ id: /((daruma-edit-alias-modal_)\S*)\b/gm })
  async editDarumaModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const newAlias = interaction.fields.getTextInputValue('new-alias');
    const newBattleCry = interaction.fields.getTextInputValue('new-battle-cry');
    const assetId = interaction.customId.split('_')[1];
    const updatedAsset = await this.algoNFTAssetService.updateAliasOrBattleCry(
      Number(assetId),
      newAlias,
      newBattleCry,
    );
    if (!updatedAsset) {
      await interaction.editReply('No asset found');
      return;
    }
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `We have updated Daruma ${updatedAsset.name}\nAlias: ${newAlias}\n BattleCry: ${newBattleCry}`,
    );
    return;
  }
}
