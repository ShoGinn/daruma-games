import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  User,
} from 'discord.js';

import { ClaimTokenResponse } from '../../types/algorand.js';

/**
 * Creates a simple yes/no button row.
 *

 * @param {string} buttonId
 * @returns {*}  {ActionRowBuilder<ButtonBuilder>}
 */
export function buildYesNoButtons(buttonId: string): ActionRowBuilder<ButtonBuilder> {
  const yesButton = new ButtonBuilder()
    .setCustomId(`simple-yes_${buttonId}`)
    .setEmoji('✅')
    .setStyle(ButtonStyle.Primary);

  const noButton = new ButtonBuilder()
    .setCustomId(`simple-no_${buttonId}`)
    .setEmoji('❌')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(yesButton, noButton);
}
/**
 * Builds an add/remove button row.
 *
 * @param {string} buttonId
 * @param {string} buttonName
 * @param {boolean} [includeRemoveButton=false]
 * @returns {*}  {ActionRowBuilder<ButtonBuilder>}
 */
export function buildAddRemoveButtons(
  buttonId: string,
  buttonName: string,
  includeRemoveButton: boolean = false,
): ActionRowBuilder<ButtonBuilder> {
  const addButton = buildAddButton(buttonId, buttonName);
  if (!includeRemoveButton) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(addButton);
  }
  const removeButton = buildRemoveButton(buttonId, buttonName);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(addButton, removeButton);
}

/**
 * Builds an add button.
 *
 * @param {string} buttonId
 * @param {string} buttonName
 * @returns {*}  {ButtonBuilder}
 */
const buildAddButton = (buttonId: string, buttonName: string): ButtonBuilder => {
  return new ButtonBuilder()
    .setCustomId(`simple-add-${buttonName}_${buttonId}`)
    .setEmoji('➕')
    .setStyle(ButtonStyle.Primary);
};

/**
 * Builds a remove button.
 *
 * @param {string} buttonId
 * @param {string} buttonName
 * @returns {*}  {ButtonBuilder}
 */
const buildRemoveButton = (buttonId: string, buttonName: string): ButtonBuilder => {
  return new ButtonBuilder()
    .setCustomId(`simple-remove-${buttonName}_${buttonId}`)
    .setEmoji('➖')
    .setStyle(ButtonStyle.Danger);
};

export function customButton(buttonId: string, label: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`custom-button_${buttonId}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary);
}

export const createAlgoExplorerButton = (txId: string): ActionRowBuilder<ButtonBuilder> => {
  const sendAssetEmbedButton = new ActionRowBuilder<ButtonBuilder>();
  sendAssetEmbedButton.addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('AlgoExplorer')
      .setURL(`https://algoexplorer.io/tx/${txId}`),
  );
  return sendAssetEmbedButton;
};

export const createSendAssetEmbed = (
  assetName: string,
  amount: number,
  author: User,
  receiver: GuildMember,
  reason?: string | undefined,
): EmbedBuilder => {
  const sendAssetEmbed = new EmbedBuilder()
    .setTitle(`${assetName} Algorand Network Transaction`)
    .setDescription(
      `Processing the transaction of ${amount.toLocaleString()} ${assetName} to ${receiver.toString()}...`,
    )
    .setAuthor({
      name: author.username,
      iconURL: author.displayAvatarURL(),
    })
    .setTimestamp();
  if (reason) {
    sendAssetEmbed.addFields({
      name: 'Reason Sent',
      value: reason,
    });
  }
  return sendAssetEmbed;
};

export const claimTokenResponseEmbedUpdate = (
  embed: EmbedBuilder,
  assetName: string,
  claimStatus: ClaimTokenResponse,
  receiver: GuildMember,
): EmbedBuilder => {
  // Get the original fields from the embed
  const claimStatusFormatted = humanFriendlyClaimStatus(claimStatus);
  if (claimStatus.txId) {
    embed.setDescription(
      `Sent ${claimStatusFormatted.transactionAmount} ${assetName} to ${receiver.toString()}`,
    );
    embed.addFields(
      {
        name: 'Txn ID',
        value: claimStatusFormatted.txId,
      },
      {
        name: 'Txn Hash',
        value: claimStatusFormatted.confirmedRound,
      },
      {
        name: 'Transaction Amount',
        value: claimStatusFormatted.transactionAmount,
      },
    );
    return embed;
  } else {
    embed.setDescription(`There was an error sending the ${assetName} to ${receiver.toString()}`);
    embed.addFields({
      name: 'Error',
      value: JSON.stringify(claimStatus),
    });
  }
  return embed;
};

export function humanFriendlyClaimStatus(claimStatus: ClaimTokenResponse): {
  txId: string;
  confirmedRound: string;
  transactionAmount: string;
} {
  return {
    txId: claimStatus.txId ?? 'Unknown',
    confirmedRound: claimStatus.status?.['confirmed-round']?.toString() ?? 'Unknown',
    transactionAmount: claimStatus.status?.txn.txn.aamt?.toLocaleString() ?? 'Unknown',
  };
}
