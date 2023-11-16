import {
  ActionRowBuilder,
  ApplicationCommandType,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserContextMenuCommandInteraction,
} from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';
import { Category, PermissionGuard } from '@discordx/utilities';
import {
  ButtonComponent,
  ContextMenu,
  Discord,
  Guard,
  ModalComponent,
  Slash,
  SlashGroup,
} from 'discordx';

import { isValidAddress } from 'algosdk';
import { inject, injectable } from 'tsyringe';

import { InternalUserIDs, internalUsernames } from '../enums/daruma-training.js';
import { BotOwnerOnly } from '../guards/bot-owner-only.js';
import { AlgoStdAssetsService } from '../services/algo-std-assets.js';
import { GameAssets } from '../services/game-assets.js';
import { InternalUserService } from '../services/internal-user.js';
import { WalletAddress } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { buildAddRemoveButtons } from '../utils/functions/algo-embeds.js';
import logger from '../utils/functions/logger-factory.js';

@Discord()
@injectable()
@Category('Developer')
@Guard(BotOwnerOnly)
export default class SetupCommand {
  constructor(
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(AlgoStdAssetsService) private stdAssetsService: AlgoStdAssetsService,
    @inject(InternalUserService) private internalUserService: InternalUserService,
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
  setupButtons = (): ActionRowBuilder<ButtonBuilder> => {
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

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      creatorWallet,
      reservedWallet,
      stdAsset,
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
    internalUser: InternalUserIDs,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const walletType = this.getInternalUserName(internalUser);
    let wallets: string[];
    let buttonName: string;
    if (internalUser === InternalUserIDs.creator) {
      wallets = await this.internalUserService.getCreatorWallets();
      buttonName = this.buttonFunctionNames.creatorWallet;
    } else if (internalUser === InternalUserIDs.reserved) {
      wallets = await this.internalUserService.getReservedWallets();
      buttonName = this.buttonFunctionNames.reservedWallet;
    } else {
      throw new Error('Invalid Internal User ID');
    }
    const embedsObject: BaseMessageOptions[] = [];
    wallets.map((wallet, index) => {
      const embed = new EmbedBuilder().setTitle(`${walletType} Wallets`);
      embed.addFields({ name: `Wallet ${index + 1}`, value: wallet });
      const buttonRow = buildAddRemoveButtons(wallet, buttonName, wallets.length > 0);
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
              .setDescription(`Add a ${walletType} wallet by hitting the plus sign below!`),
          ],
          components: [buildAddRemoveButtons('newOnly', buttonName, false)],
        };
        await InteractionUtils.replyOrFollowUp(interaction, noWalletsEmbed);
        return;
      }
    }

    const pagination = new Pagination(
      interaction,
      embedsObject.map((embed) => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
        onTimeout: () => {
          interaction.deleteReply().catch(() => null);
        },
        // 30 Seconds in ms
        time: 30_000,
      },
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
    internalUser: InternalUserIDs,
  ): Promise<void> {
    const newWallet = interaction.fields.getTextInputValue('new-wallet') as WalletAddress;
    const walletType = this.getInternalUserName(internalUser);
    await interaction.deferReply({ ephemeral: true });
    if (!isValidAddress(newWallet)) {
      await InteractionUtils.replyOrFollowUp(interaction, 'Invalid Wallet Address');
      return;
    }
    // Add Creator wallet to the database
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Adding ${walletType} Wallet.. this may take a while`,
    );
    let createdWallet: string;
    if (internalUser === InternalUserIDs.creator) {
      createdWallet = await this.internalUserService.addCreatorWallet(newWallet);
    } else if (internalUser === InternalUserIDs.reserved) {
      createdWallet = await this.internalUserService.addReservedWallet(newWallet);
    } else {
      throw new Error('Invalid Internal User ID');
    }
    await interaction.editReply(`${walletType} Wallet Address: ${newWallet}\n${createdWallet}`);
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
  async removeWallet(interaction: ButtonInteraction, internalUser: InternalUserIDs): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const address = interaction.customId.split('_')[1] as WalletAddress;
    if (!address) {
      throw new Error('No address found');
    }
    if (internalUser === InternalUserIDs.creator) {
      await this.internalUserService.removeCreatorWallet(address);
    } else if (internalUser === InternalUserIDs.reserved) {
      await this.internalUserService.removeReservedWallet(address);
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
    const stdAssets = await this.stdAssetsService.getAllStdAssets();
    const embedsObject: BaseMessageOptions[] = [];
    stdAssets.map((asset, index) => {
      const embed = new EmbedBuilder().setTitle('Standard Assets');
      embed.addFields(
        {
          name: `Asset ${index + 1}`,
          value: asset.name,
        },
        { name: 'Asset ID', value: asset._id.toString(), inline: true },
        { name: 'Asset Name', value: asset.name, inline: true },
        { name: 'Asset Unit-Name', value: asset.unitName, inline: true },
      );
      const buttonRow = buildAddRemoveButtons(
        asset._id.toString(),
        this.buttonFunctionNames.addStd,
        stdAssets.length > 1,
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
          components: [buildAddRemoveButtons('newOnly', this.buttonFunctionNames.addStd, false)],
        };
        await InteractionUtils.replyOrFollowUp(interaction, noAssetsEmbed);
        return;
      }
    }

    const pagination = new Pagination(
      interaction,
      embedsObject.map((embed) => embed),
      {
        type: PaginationType.Button,
        showStartEnd: false,
        onTimeout: () => {
          interaction.deleteReply().catch(() => null);
        },
        // 30 Seconds in ms
        time: 30_000,
      },
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
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Checking ${newAsset}... this may take a while`,
    );
    let message = '';
    try {
      const asset = await this.stdAssetsService.addAlgoStdAsset(newAsset);
      message = asset
        ? `Standard Asset with ID: ${newAsset} Name/Unit-Name: ${asset.name}/${asset.unitName} added to the database`
        : `Standard Asset with ID: ${newAsset} already exists in the database`;
    } catch (error) {
      if (error instanceof Error) {
        message = error.message;
      }
    }
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: message,
      ephemeral: true,
    });
    if (!this.gameAssets.isReady()) {
      logger.info('Running the Game Asset Init');
      await this.gameAssets.initializeAll();
    }
  }
  @ButtonComponent({ id: /((simple-remove-addStd_)\S*)\b/gm })
  async removeStdAsset(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const address = interaction.customId.split('_')[1];
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Deleting Address: ${address} for ASA's...`,
    );
    try {
      await this.stdAssetsService.deleteStdAsset(Number(address));
    } catch (error) {
      if (error instanceof Error) {
        await InteractionUtils.replyOrFollowUp(interaction, {
          content: error.message,
          ephemeral: true,
        });
        return;
      }
    }
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: `ASA's deleted for Wallet Address: ${address}`,
      ephemeral: true,
    });
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
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Forcing an Out of Cycle Creator Asset Sync...`,
    );
    await this.internalUserService.creatorAssetSync();
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'Creator Asset Sync Complete',
      ephemeral: true,
    });
  }
}
