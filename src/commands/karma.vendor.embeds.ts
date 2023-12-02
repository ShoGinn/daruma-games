import {
  ActionRowBuilder,
  bold,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  inlineCode,
  italic,
} from 'discord.js';

import { container } from 'tsyringe';

import { karmaVendor } from '../core/constants.js';
import { TenorImageManager } from '../manager/tenor-image.js';
import { RewardTokenWallet, WalletAddress } from '../types/core.js';

export async function shadyShopEmbed(
  karmaAssetName: string,
  userKarmaWallet: RewardTokenWallet<WalletAddress>,
): Promise<{
  shadyEmbeds: EmbedBuilder;
  shadyComponents: ActionRowBuilder<ButtonBuilder>;
}> {
  // Build the embed
  const tenorManager = container.resolve(TenorImageManager);
  const tenorUrl = await tenorManager.fetchRandomTenorGif('trust me, shady, scary');

  const coolDownOfferEmbed = new EmbedBuilder()
    .setTitle('A Shady Offer')
    .setDescription(
      `${italic('Have I got a deal for you!')}\n
    A little bird told me you had some spare ${bold(karmaAssetName)}!\n
    ${inlineCode(userKarmaWallet.convertedTokens.toLocaleString())} to be exact\n
    I just figured out a new recipe for a for an elixir that works every time!\n\n
        But don't tell anyone about this, it's a secret!\n\n
        I have a limited supply of this elixir and I'm willing to sell it to you for a limited time!\n\n
        Don't let the price fool you, this is a once in a lifetime deal!\n\n
        Did I mention that this elixir works every time?\n\n
        Don't listen to anyone who says otherwise!\n\n`,
    )
    .setImage(tenorUrl);
  // Build the fields for the elixirs and their prices and add them to the embed if the user has enough karma
  const uptoFiveCoolDownField = {
    name: '5.. yeah 5.. Daruma cooldowns removed!',
    value: `For only ${karmaVendor.uptoFiveCoolDown} ${karmaAssetName}!`,
    inline: true,
  };
  const uptoTenCoolDownField = {
    name: '10 __guaranteed__ Daruma cooldowns removed! (no refunds)',
    value: `For only ${karmaVendor.uptoTenCoolDown} ${karmaAssetName}!`,
    inline: true,
  };
  const uptoFifteenCoolDownField = {
    name: '15 Daruma cooldowns removed! (no refunds no questions asked no telling anyone)',
    value: `For only ${karmaVendor.uptoFifteenCoolDown} ${karmaAssetName}!`,
    inline: true,
  };
  if (userKarmaWallet.convertedTokens >= karmaVendor.uptoFiveCoolDown) {
    coolDownOfferEmbed.addFields(uptoFiveCoolDownField);
  }
  if (userKarmaWallet.convertedTokens >= karmaVendor.uptoTenCoolDown) {
    coolDownOfferEmbed.addFields(uptoTenCoolDownField);
  }
  if (userKarmaWallet.convertedTokens >= karmaVendor.uptoFifteenCoolDown) {
    coolDownOfferEmbed.addFields(uptoFifteenCoolDownField);
  }
  // Build the buttons
  const uptoFiveCoolDownButton = new ButtonBuilder()
    .setCustomId(`uptoFiveCoolDown`)
    .setLabel('5')
    .setStyle(ButtonStyle.Primary);
  const uptoTenCoolDownButton = new ButtonBuilder()
    .setCustomId(`uptoTenCoolDown`)
    .setLabel('10')
    .setStyle(ButtonStyle.Secondary);
  const uptoFifteenCoolDownButton = new ButtonBuilder()
    .setCustomId(`uptoFifteenCoolDown`)
    .setLabel('15')
    .setStyle(ButtonStyle.Danger);
  const uptoFiveCoolDownButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    uptoFiveCoolDownButton,
    uptoTenCoolDownButton,
    uptoFifteenCoolDownButton,
  );
  // Send the embed and buttons
  return {
    shadyEmbeds: coolDownOfferEmbed,
    shadyComponents: uptoFiveCoolDownButtonRow,
  };
}
