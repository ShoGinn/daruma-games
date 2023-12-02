import {
  ActionRowBuilder,
  ButtonInteraction,
  EmbedBuilder,
  MessageReplyOptions,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';

import { setupButtonFunctionNames } from '../core/constants.js';
import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { buildAddRemoveButtons } from '../utils/functions/algo-embeds.js';

export async function paginatedStdAssetWallets(
  interaction: ButtonInteraction,
  stdAssets: AlgoStdAsset[],
): Promise<void> {
  const stdAssetEmbeds = stdAssets.map((asset, index) => {
    return buildStdAssetEmbed(asset, index + 1);
  });
  const paginatedEmbeds = stdAssetEmbeds.length > 0 ? stdAssetEmbeds : [buildStdAssetEmbed()];
  const pagination = new Pagination(interaction, paginatedEmbeds, {
    type: PaginationType.Button,
    showStartEnd: false,
  });
  await pagination.send();
}
function buildStdAssetEmbed(asset?: AlgoStdAsset, index?: number): MessageReplyOptions {
  const embed = new EmbedBuilder();
  embed.setTitle('Standard Assets');
  let buttonRow;

  if (asset) {
    embed.addFields(
      {
        name: `Asset ${index}`,
        value: asset.name,
      },
      { name: 'Asset ID', value: asset._id.toString(), inline: true },
      { name: 'Asset Name', value: asset.name, inline: true },
      { name: 'Asset Unit-Name', value: asset.unitName, inline: true },
    );
    buttonRow = buildAddRemoveButtons(asset._id.toString(), setupButtonFunctionNames.addStd, true);
  } else {
    embed.setDescription('Add a standard asset by hitting the plus sign below!');
    buttonRow = buildAddRemoveButtons('newWallet', setupButtonFunctionNames.addStd, false);
  }

  return { embeds: [embed], components: [buttonRow] };
}
export async function buildStdAssetModal(interaction: ButtonInteraction): Promise<void> {
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
