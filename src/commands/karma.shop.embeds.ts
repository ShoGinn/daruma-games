import {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  inlineCode,
} from 'discord.js';

import { karmaShop } from '../core/constants.js';
import { OptimizedImages } from '../enums/daruma-training.js';
import { emojiConvert } from '../utils/functions/dt-emojis.js';
import { optimizedImageHostedUrl } from '../utils/functions/dt-images.js';

export function karmaShopEmbedGenerator(
  userArtifacts: number,
  claimedKarma: number,
  claimedEnlightenment: number,
  karmaAssetName: string,
): { shopEmbed: EmbedBuilder; shopButtonRow: ActionRowBuilder<ButtonBuilder> } {
  const userClaimedKarma = claimedKarma;
  // total pieces are the total number of artifacts the user has and arms are the first 2 artifacts and legs are the last 2 artifacts
  const totalPieces = userArtifacts;
  const totalEnlightened = claimedEnlightenment;
  const justArtifactsField: APIEmbedField = {
    name: 'Artifacts Gathered',
    value: emojiConvert(totalPieces.toString()),
    inline: true,
  };
  const enlightenMentField: APIEmbedField = {
    name: 'Enlightenment',
    value: emojiConvert(totalEnlightened.toString()),
  };

  const shopEmbed = new EmbedBuilder();
  if (userClaimedKarma >= karmaShop.artifactCost || totalPieces >= karmaShop.necessaryArtifacts) {
    shopEmbed.setColor('Green');
  } else {
    shopEmbed.setColor('Red');
  }
  shopEmbed.setTitle(`Welcome to The ${karmaAssetName} Shop`);
  shopEmbed.setImage(optimizedImageHostedUrl(OptimizedImages.SHOP));
  shopEmbed.setFooter({
    text: `To claim your ${karmaAssetName} use ${inlineCode(
      '/karma claim',
    )}\nDon't see what you expect? Use ${inlineCode('/wallet')} to verify.`,
  });
  shopEmbed.setDescription(
    `Here you can use ${karmaAssetName} to achieve enlightenment!\n\n**To reach enlightenment you must gather ${emojiConvert(
      karmaShop.necessaryArtifacts.toString(),
    )} artifacts**\n\n__Each artifact costs ${karmaShop.artifactCost.toLocaleString()} ${karmaAssetName}__\n\n*Your ${karmaAssetName} must be claimed and in the Algorand network before you can spend it!*\n\nYou currently have ${inlineCode(
      userClaimedKarma.toLocaleString(),
    )}`,
  );

  // Create the buttons
  const buyArtifactButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel('Buy Artifact')
    .setCustomId('buyArtifact')
    .setDisabled(true);
  const buyEnlightenmentButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Success)
    .setLabel('Achieve Enlightenment')
    .setCustomId('buyEnlightenment')
    .setDisabled(true);

  if (userClaimedKarma >= karmaShop.artifactCost) {
    buyArtifactButton.setDisabled(false);
  }
  // add either arms and legs or just artifacts to an embed
  const shopEmbedFields = [justArtifactsField];
  // add enlightenment to the embed
  shopEmbedFields.push(enlightenMentField);

  if (totalPieces >= karmaShop.necessaryArtifacts) {
    buyEnlightenmentButton.setDisabled(false);
    // Add a field to show how many enlightenments they are eligible for
    const enlightenments = Math.floor(totalPieces / karmaShop.necessaryArtifacts);
    if (shopEmbedFields[0]) {
      shopEmbedFields[0].inline = true;
    }
    shopEmbedFields.splice(
      1,
      0,
      {
        name: 'Enlightenments Available',
        value: emojiConvert(enlightenments.toString()),
        inline: true,
      },
      { name: '\u200B', value: '\u200B', inline: true },
    );
  }
  shopEmbed.addFields(shopEmbedFields);
  const shopButtonRow = new ActionRowBuilder<ButtonBuilder>();
  if (userClaimedKarma >= karmaShop.artifactCost * karmaShop.necessaryArtifacts) {
    const buyMaxArtifactButton = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel(`Buy ${karmaShop.necessaryArtifacts} Artifacts`)
      .setCustomId('buyMaxArtifacts');
    shopButtonRow.addComponents(buyMaxArtifactButton);
  }
  shopButtonRow.addComponents(buyArtifactButton, buyEnlightenmentButton);

  return { shopEmbed, shopButtonRow };
}
