import {
  ButtonInteraction,
  ComponentType,
  GuildMember,
  inlineCode,
  InteractionReplyOptions,
} from 'discord.js';

import { inject, injectable } from 'tsyringe';

import { karmaVendor } from '../core/constants.js';
import { AlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { isTransferError } from '../services/algorand.errorprocessor.js';
import { Algorand } from '../services/algorand.js';
import { RewardsService } from '../services/rewards.js';
import { TransactionResultOrError } from '../types/algorand.js';
import { DiscordId } from '../types/core.js';
import type { RewardTokenWallet, SenderWalletAddress } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';
import { RandomUtils } from '../utils/classes/random-utils.js';
import { assetName } from '../utils/functions/dt-embeds.js';
import { karmaElixirWebHook } from '../utils/functions/web-hooks.js';

import { shadyShopEmbed } from './karma.vendor.embeds.js';

@injectable()
export class KarmaVendorCommandService {
  constructor(
    @inject(RewardsService) private rewardsService: RewardsService,
    @inject(Algorand) private algorand: Algorand,
    @inject(AlgoNFTAssetService) private algoNftService: AlgoNFTAssetService,
  ) {}
  async shadyShop(
    interaction: ButtonInteraction,
    karmaAsset: AlgoStdAsset,
  ): Promise<InteractionReplyOptions | undefined> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const karmaSenderWallet = await this.rewardsService.getRewardsTokenWalletWithMostTokens(
      caller.id as DiscordId,
      karmaAsset._id,
    );
    if (!karmaSenderWallet) {
      return {
        content: `You don't have any ${karmaAsset.name}!`,
      };
    }
    if (karmaSenderWallet.convertedTokens < karmaVendor.uptoFiveCoolDown) {
      if (karmaSenderWallet.temporaryTokens > karmaVendor.uptoFiveCoolDown) {
        return {
          content: `You don't have enough ${karmaAsset.name}!!!\n\nYou have unclaimed ${
            karmaAsset.name
          }!\n\nClaim it with ${inlineCode('/claim')}\n\nThen try again.`,
        };
      }
      return {
        content: `You don't have enough ${karmaAsset.name}.\n\nCome back when you have at least ${karmaVendor.uptoFiveCoolDown} ${karmaAsset.name}!`,
      };
    }

    // Get the shop embed
    const { shadyEmbeds, shadyComponents } = await shadyShopEmbed(
      karmaAsset.name,
      karmaSenderWallet,
    );
    const message = await interaction.followUp({
      embeds: [shadyEmbeds],
      components: [shadyComponents],
    });

    // Create the collector
    const collector = message.createMessageComponentCollector({
      max: 1,
      time: 10_000,
      componentType: ComponentType.Button,
    });
    collector.on('collect', async (collectInteraction: ButtonInteraction) => {
      await collectInteraction.deferUpdate();
      // Change the footer to say please wait and remove the buttons and fields
      shadyEmbeds.setColor('Gold');
      shadyEmbeds.spliceFields(0, 25);
      shadyEmbeds.setDescription('Churning the elixir...');
      shadyEmbeds.setFooter({ text: 'Please wait...' });
      await collectInteraction.editReply({
        embeds: [shadyEmbeds],
        components: [],
      });

      let elixirPrice: number;
      let numberOfCoolDowns: number;
      switch (collectInteraction.customId) {
        case 'uptoFiveCoolDown': {
          // subtract the cost from the users wallet
          shadyEmbeds.setDescription('Buying an elixir for 5 cool downs... maybe...');
          elixirPrice = karmaVendor.uptoFiveCoolDown;
          numberOfCoolDowns = RandomUtils.random.integer(3, 5);
          break;
        }
        case 'uptoTenCoolDown': {
          // subtract the cost from the users wallet
          shadyEmbeds.setDescription('Buying an elixir for 10 cool downs... yeah 10 cool downs...');
          elixirPrice = karmaVendor.uptoTenCoolDown;
          numberOfCoolDowns = RandomUtils.random.integer(5, 10);
          break;
        }
        case 'uptoFifteenCoolDown': {
          // subtract the cost from the users wallet
          shadyEmbeds.setDescription(
            'Buying an elixir for 15 cool downs... Or you might lose your hair..',
          );
          elixirPrice = karmaVendor.uptoFifteenCoolDown;
          numberOfCoolDowns = RandomUtils.random.integer(10, 15);
          break;
        }
        default: {
          return;
        }
      }
      // subtract the cost from the users wallet
      await collectInteraction.editReply({
        embeds: [shadyEmbeds],
        components: [],
      });

      // Clawback the tokens and purchase the elixir
      const thisStatus = await this.claimElixir(
        collectInteraction,
        elixirPrice,
        numberOfCoolDowns,
        caller,
        karmaSenderWallet,
      );

      if (!isTransferError(thisStatus.claimStatus) && thisStatus.claimStatus.transaction.txID()) {
        shadyEmbeds.addFields(ObjectUtil.singleFieldBuilder('Elixir', 'Purchased!'));
        shadyEmbeds.addFields(
          ObjectUtil.singleFieldBuilder('Txn ID', thisStatus.claimStatus.transaction.txID()),
        );
        // Build array of ResetAsset Names
        const assetNames: string[] = [];
        for (const asset of thisStatus.resetAssets) {
          assetNames.push(assetName(asset));
        }
        // Add the reset assets to the embed
        shadyEmbeds.addFields(ObjectUtil.singleFieldBuilder('Reset Assets', assetNames.join(', ')));

        shadyEmbeds.setDescription('Hope you enjoy the elixir..');
        shadyEmbeds.setFooter({ text: 'No Refunds!' });
      } else {
        shadyEmbeds.addFields(ObjectUtil.singleFieldBuilder('Elixir', 'Failed to purchase!'));
      }
      await collectInteraction.editReply({
        embeds: [shadyEmbeds],
        components: [],
      });
    });
    return;
  }
  async claimElixir(
    _interaction: ButtonInteraction,
    elixirCost: number,
    coolDowns: number,
    caller: GuildMember,
    karmaSenderWallet: RewardTokenWallet<SenderWalletAddress>,
  ): Promise<{
    claimStatus: TransactionResultOrError;
    resetAssets: AlgoNFTAsset[];
  }> {
    const claimUserId = caller.id as DiscordId;
    // Get the users RX wallet
    const claimStatus = await this.algorand.purchaseItem({
      assetIndex: karmaSenderWallet.asaId,
      amount: elixirCost,
      senderAddress: karmaSenderWallet.walletAddress,
    });

    let resetAssets: AlgoNFTAsset[] = [];
    if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
      resetAssets = await this.algoNftService.randomAssetCoolDownReset(claimUserId, coolDowns);
      karmaElixirWebHook(claimStatus, caller);
    }
    return { claimStatus, resetAssets };
  }
}
