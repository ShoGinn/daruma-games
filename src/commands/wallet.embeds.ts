import {
  APIEmbedField,
  bold,
  ButtonInteraction,
  CommandInteraction,
  EmbedBuilder,
  inlineCode,
  InteractionReplyOptions,
} from 'discord.js';

import { Pagination, PaginationType } from '@discordx/pagination';

import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { Reward } from '../database/rewards/rewards.schema.js';
import { Algorand } from '../services/algorand.js';
import { WalletAddress } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { buildAddRemoveButtons, customButton } from '../utils/functions/algo-embeds.js';
import { optInButtonCreator } from '../utils/functions/dt-embeds.js';

export async function sendWalletEmbeds(
  interaction: CommandInteraction | ButtonInteraction,
  walletEmbeds?: InteractionReplyOptions[],
): Promise<void> {
  // specific embed
  const defaultEmbeds = [defaultWalletEmbed(interaction)];
  const paginatedEmbeds = walletEmbeds?.length ? walletEmbeds : defaultEmbeds;
  const pagination = new Pagination(interaction, paginatedEmbeds, {
    type: PaginationType.Button,
    showStartEnd: false,
  });
  await pagination.send();
}
function defaultWalletEmbed(
  interaction: CommandInteraction | ButtonInteraction,
): InteractionReplyOptions {
  const embed = new EmbedBuilder().setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ forceStatic: false }),
  });
  embed.setTitle('No Wallets');
  embed.setDescription('Add a wallet by hitting the plus sign below!');
  return { embeds: [embed], components: [buildAddRemoveButtons('newWallet', 'userWallet', false)] };
}
export async function buildWalletEmbed(
  interaction: CommandInteraction | ButtonInteraction,
  algoRepo: Algorand,
  currentWallet: WalletAddress,
  totalWallets: number,
  walletAssetCount: number,
  walletTokens: Reward[],
  stdAssets: AlgoStdAsset[],
  nfDomain: string[],
  randomThumbnail: string,
): Promise<InteractionReplyOptions> {
  const caller = await InteractionUtils.getInteractionCaller(interaction);

  const defaultEmbed = defaultWalletEmbed(interaction);
  let embed: EmbedBuilder;
  if (defaultEmbed.embeds && defaultEmbed.embeds.length > 0) {
    embed = defaultEmbed.embeds[0] as EmbedBuilder;
  } else {
    throw new Error('No embed found');
  }
  embed.setTitle('Owned Wallets');
  embed.setThumbnail(randomThumbnail);
  embed.setAuthor({
    name: caller.user.username,
    iconURL: caller.user.displayAvatarURL({ forceStatic: false }),
  });
  embed.setDescription(
    `${bold(
      totalWallets.toLocaleString(),
    )} :file_folder: :white_small_square: ${walletAssetCount} assets`,
  );

  let nfDomainString = '';
  // join the array of domains into a string and add currentWallet.address to the end
  nfDomainString =
    nfDomain.length > 0
      ? `${inlineCode(nfDomain.join(', '))} ${currentWallet}`
      : inlineCode(currentWallet);

  const tokenFields: APIEmbedField[] = [
    {
      name: 'Wallet Address',
      value: nfDomainString,
      inline: false,
    },
  ];
  const buttonRow = buildAddRemoveButtons(currentWallet, 'userWallet', true);

  for (const stdAsset of stdAssets) {
    const walletToken = walletTokens.find((token) => token.asaId === stdAsset._id);
    const currentToken = walletToken
      ? await algoRepo.getTokenOptInStatus(currentWallet, walletToken.asaId)
      : { optedIn: false, tokens: null };
    const claimedTokens = currentToken.tokens?.toLocaleString() ?? '0';
    const unclaimedtokens = walletToken?.temporaryTokens.toLocaleString() ?? '0';
    const optedIn = currentToken.optedIn ? ':white_check_mark:' : ':x:';
    const tokenName = stdAsset.name;
    if (!currentToken.optedIn) {
      buttonRow.addComponents(optInButtonCreator(stdAsset._id, tokenName));
    }
    tokenFields.push({
      name: `${tokenName} (${stdAsset._id})`,
      value: `Claimed: ${inlineCode(claimedTokens)} \nUnclaimed: ${inlineCode(
        unclaimedtokens,
      )} \nOpted In: ${optedIn}`,
    });
  }
  embed.addFields(tokenFields);
  if (walletAssetCount > 0) {
    buttonRow.addComponents(customButton(caller.id, 'Customize your Daruma'));
  }
  return {
    embeds: [embed],
    components: [buttonRow],
  };
}
