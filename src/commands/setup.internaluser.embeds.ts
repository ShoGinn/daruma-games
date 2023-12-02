import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageReplyOptions,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';

import { setupButtonFunctionNames } from '../core/constants.js';
import { InternalUser } from '../services/internal-user.js';
import { WalletAddress } from '../types/core.js';
import { buildAddRemoveButtons } from '../utils/functions/algo-embeds.js';

export function setupAssets(): InteractionReplyOptions {
  const embed = new EmbedBuilder()
    .setTitle('Setup')
    .setDescription('Use the buttons below to setup the bot');

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

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    creatorWallet,
    reservedWallet,
    stdAsset,
  );
  return { embeds: [embed], components: [buttons] };
}

export async function setupPaginatedWallets(
  interaction: ButtonInteraction,
  internalUser: InternalUser,
  internalUserWallets: WalletAddress[],
): Promise<void> {
  const walletEmbeds = internalUserWallets.map((wallet, index) => {
    return buildWalletEmbed(internalUser, wallet, index + 1);
  });
  const paginatedEmbeds = walletEmbeds.length > 0 ? walletEmbeds : [buildWalletEmbed(internalUser)];
  const pagination = new Pagination(interaction, paginatedEmbeds, {
    type: PaginationType.Button,
    showStartEnd: false,
  });
  await pagination.send();
}
function buildWalletEmbed(
  internalUser: InternalUser,
  wallet?: WalletAddress,
  walletNumber?: number,
): MessageReplyOptions {
  const walletType = internalUser.username;
  let buttonName: string;

  if (internalUser.isCreator) {
    buttonName = setupButtonFunctionNames.creatorWallet;
  } else if (internalUser.isReserved) {
    buttonName = setupButtonFunctionNames.reservedWallet;
  } else {
    throw new Error('Invalid Internal User ID');
  }

  const embed = new EmbedBuilder();
  embed.setTitle(`${walletType} Wallets`);
  let buttonRow = buildAddRemoveButtons('newWallet', buttonName, false);

  if (wallet) {
    embed.addFields({ name: `Wallet ${walletNumber}`, value: wallet });
    buttonRow = buildAddRemoveButtons(wallet, buttonName, true);
  } else {
    embed.setDescription(`Add a ${walletType} wallet by hitting the plus sign below!`);
  }
  return { embeds: [embed], components: [buttonRow] };
}
export async function buildAddWalletModal(
  interaction: ButtonInteraction,
  internalUser: InternalUser,
): Promise<void> {
  const walletType = internalUser.username;

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
