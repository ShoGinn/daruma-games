import {
  ApplicationCommandType,
  ButtonInteraction,
  CommandInteraction,
  ModalSubmitInteraction,
  UserContextMenuCommandInteraction,
} from 'discord.js';

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

import { inject, injectable } from 'tsyringe';

import { BotOwnerOnly } from '../guards/bot-owner-only.js';
import { internalUserCreator, internalUserReserved } from '../services/internal-user.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';

import { buildAddWalletModal, setupAssets } from './setup.internaluser.embeds.js';
import { SetupInternalUserCommandService } from './setup.internaluser.service.js';
import { buildStdAssetModal } from './setup.standard-asset.embeds.js';
import { SetupStandardAssetCommandService } from './setup.standard-asset.service.js';

@Discord()
@injectable()
@Category('Developer')
@Guard(BotOwnerOnly)
export default class SetupCommand {
  constructor(
    @inject(SetupInternalUserCommandService)
    private setupInternalUserCommandService: SetupInternalUserCommandService,
    @inject(SetupStandardAssetCommandService)
    private setupStandardAssetCommandService: SetupStandardAssetCommandService,
  ) {}

  @Slash({ name: 'setup', description: 'Setup The Bot' })
  @SlashGroup('dev')
  async setup(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = setupAssets();
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @ButtonComponent({ id: 'creatorWallet' })
  async creatorWalletButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    await this.setupInternalUserCommandService.setupWalletButtons(interaction, internalUserCreator);
  }
  @ButtonComponent({ id: 'reservedWallet' })
  async reservedWalletButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await this.setupInternalUserCommandService.setupWalletButtons(
      interaction,
      internalUserReserved,
    );
  }
  @ButtonComponent({ id: /((simple-add-creatorWalletButton_)\S*)\b/gm })
  async addCreatorWalletButton(interaction: ButtonInteraction): Promise<void> {
    await buildAddWalletModal(interaction, internalUserCreator);
  }
  @ButtonComponent({ id: /((simple-add-reservedWalletButton_)\S*)\b/gm })
  async addReservedWalletButton(interaction: ButtonInteraction): Promise<void> {
    await buildAddWalletModal(interaction, internalUserReserved);
  }
  @ModalComponent()
  async addCreatorWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
    const embed = await this.setupInternalUserCommandService.addWalletModal(
      interaction,
      internalUserCreator,
    );
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @ModalComponent()
  async addReservedWalletModal(interaction: ModalSubmitInteraction): Promise<void> {
    const embed = await this.setupInternalUserCommandService.addWalletModal(
      interaction,
      internalUserReserved,
    );
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @ButtonComponent({ id: /((simple-remove-creatorWalletButton_)\S*)\b/gm })
  async removeCreatorWalletButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embed = await this.setupInternalUserCommandService.removeWallet(
      interaction,
      internalUserCreator,
    );

    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @ButtonComponent({ id: /((simple-remove-reservedWalletButton_)\S*)\b/gm })
  async removeReservedWalletButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embed = await this.setupInternalUserCommandService.removeWallet(
      interaction,
      internalUserReserved,
    );

    await InteractionUtils.replyOrFollowUp(interaction, embed);
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

    const content = await this.setupInternalUserCommandService.creatorAssetSync();

    await InteractionUtils.replyOrFollowUp(interaction, content);
  }

  //*!
  /* Std Asset */
  //*!
  @ButtonComponent({ id: 'stdAsset' })
  async stdAssetWalletButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await this.setupStandardAssetCommandService.stdAssetWallets(interaction);
  }

  @ButtonComponent({ id: /((simple-add-addStd_)\S*)\b/gm })
  async addStdAsset(interaction: ButtonInteraction): Promise<void> {
    await buildStdAssetModal(interaction);
  }
  @ModalComponent()
  async addStdAssetModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = await this.setupStandardAssetCommandService.addStdAsset(interaction);
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  @ButtonComponent({ id: /((simple-remove-addStd_)\S*)\b/gm })
  async removeStdAsset(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = await this.setupStandardAssetCommandService.removeStdAsset(interaction);
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
}
