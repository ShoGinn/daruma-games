import { ButtonInteraction, InteractionReplyOptions, ModalSubmitInteraction } from 'discord.js';

import { isValidAddress } from 'algosdk';
import { inject, injectable } from 'tsyringe';

import { InternalUser, InternalUserService } from '../services/internal-user.js';
import { WalletAddress } from '../types/core.js';

import { setupPaginatedWallets } from './setup.internaluser.embeds.js';

@injectable()
export class SetupInternalUserCommandService {
  constructor(@inject(InternalUserService) private internalUserService: InternalUserService) {}
  async setupWalletButtons(
    interaction: ButtonInteraction,
    internalUser: InternalUser,
  ): Promise<void> {
    const wallets = await this.internalUserService.getUserWallets(internalUser);
    await setupPaginatedWallets(interaction, internalUser, wallets);
  }
  async addWalletModal(
    interaction: ModalSubmitInteraction,
    internalUser: InternalUser,
  ): Promise<InteractionReplyOptions> {
    const newWallet = interaction.fields.getTextInputValue('new-wallet') as WalletAddress;
    const walletType = internalUser.username;
    await interaction.deferReply({ ephemeral: true });
    if (!isValidAddress(newWallet)) {
      return { content: 'Invalid Wallet Address' };
    }
    const createdWallet = await this.internalUserService.addInternalUserWallet(
      newWallet,
      internalUser,
    );
    return { content: `${walletType} Wallet Address: ${newWallet}\n${createdWallet}` };
  }
  async removeWallet(
    interaction: ButtonInteraction,
    internalUser: InternalUser,
  ): Promise<InteractionReplyOptions> {
    const address = interaction.customId.split('_')[1] as WalletAddress;
    if (!address) {
      return { content: 'Invalid Wallet Address' };
    }
    const message = await this.internalUserService.removeInternalUserWallet(address, internalUser);
    return { content: message };
  }
  async creatorAssetSync(): Promise<InteractionReplyOptions> {
    await this.internalUserService.creatorAssetSync();
    return { content: 'Creator Assets Synced' };
  }
}
