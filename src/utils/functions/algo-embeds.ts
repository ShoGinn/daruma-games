import {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  User,
} from 'discord.js';

import { SendTransactionResult } from '@algorandfoundation/algokit-utils/types/transaction';

import {
  defaultAssetExplorerConfig,
  defaultTransactionExplorerConfig,
} from '../../core/constants.js';
import { isTransferError } from '../../services/algorand.errorprocessor.js';
import { TransactionResultOrError } from '../../types/algorand.js';

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

export const createTransactionExplorerButton = (txId: string): ActionRowBuilder<ButtonBuilder> => {
  const sendAssetEmbedButton = new ActionRowBuilder<ButtonBuilder>();
  const transactionExplorerUrl = generateTransactionExplorerUrl(txId);
  sendAssetEmbedButton.addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('View transaction on the Blockchain')
      .setURL(transactionExplorerUrl),
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
  claimStatus: TransactionResultOrError,
  receiver: GuildMember,
): EmbedBuilder => {
  // Get the original fields from the embed
  if (!isTransferError(claimStatus) && claimStatus?.transaction.txID()) {
    const claimStatusFormatted = humanFriendlyClaimStatus(claimStatus);

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
    const errorJson = JSON.stringify(claimStatus);
    const errorFields = jsonToEmbedFields(errorJson);
    embed.addFields(...errorFields);
  }
  return embed;
};

export function humanFriendlyClaimStatus(claimStatus: SendTransactionResult | undefined): {
  txId: string;
  confirmedRound: string;
  transactionAmount: string;
} {
  return {
    txId: claimStatus?.transaction.txID() ?? 'Unknown',
    confirmedRound: claimStatus?.confirmation?.confirmedRound?.toString() ?? 'Unknown',
    transactionAmount: claimStatus?.transaction?.amount?.toLocaleString() ?? 'Unknown',
  };
}
export function jsonToEmbedFields(json: string): APIEmbedField[] {
  // Parse the JSON string back into an object
  const object = JSON.parse(json);

  // Map each key-value pair in the object to an APIEmbedField
  const embedFields = Object.entries(object).map(([key, value]) => {
    let stringValue = JSON.stringify(value); // Convert value to string in case it's not a string
    if (typeof value === 'string') {
      stringValue = stringValue.slice(1, -1); // Remove quotes if value is a string
    }
    return {
      name: key,
      value: stringValue,
      inline: true,
    };
  });

  return embedFields;
}
export function generateAssetExplorerUrl(assetId: string | number): string {
  const path = defaultAssetExplorerConfig.pathFormat.replace('{assetId}', String(assetId));
  return `${defaultAssetExplorerConfig.baseUrl}${path}`;
}
export function generateTransactionExplorerUrl(txnId: string): string {
  const path = defaultTransactionExplorerConfig.pathFormat.replace('{txnId}', txnId);
  return `${defaultTransactionExplorerConfig.baseUrl}${path}`;
}
