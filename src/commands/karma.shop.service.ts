import {
  ButtonInteraction,
  CommandInteraction,
  ComponentType,
  GuildMember,
  inlineCode,
  InteractionReplyOptions,
} from 'discord.js';

import { RateLimit, TIME_UNIT } from '@discordx/utilities';
import { Guard } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { karmaShop } from '../core/constants.js';
import { OptimizedImages } from '../enums/daruma-training.js';
import { GameAssetsNeeded } from '../guards/game-assets-needed.js';
import { isTransferError } from '../services/algorand.errorprocessor.js';
import { Algorand } from '../services/algorand.js';
import { GameAssets } from '../services/game-assets.js';
import { RewardsService } from '../services/rewards.js';
import { UserService } from '../services/user.js';
import { TransactionResultOrError } from '../types/algorand.js';
import { DiscordId } from '../types/core.js';
import type { ReceiverWalletAddress } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';
import { walletButtonCreator } from '../utils/functions/dt-embeds.js';
import { optimizedImageHostedUrl } from '../utils/functions/dt-images.js';
import { karmaArtifactWebHook, karmaEnlightenmentWebHook } from '../utils/functions/web-hooks.js';

import { karmaShopEmbedGenerator } from './karma.shop.embeds.js';

@injectable()
export class KarmaShopCommandService {
  constructor(
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(RewardsService) private rewardsService: RewardsService,
    @inject(UserService) private userService: UserService,
    @inject(Algorand) private algorand: Algorand,
  ) {}
  async karmaShop(interaction: CommandInteraction): Promise<InteractionReplyOptions | undefined> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const discordUserId = caller.id as DiscordId;
    const databaseUser = await this.userService.getUserByID(discordUserId);
    // Get the shop embed
    const karmaRxWallet =
      await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
        discordUserId,
        this.gameAssets.karmaAsset._id,
      );
    const enlightenmentRxWallet =
      await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
        discordUserId,
        this.gameAssets.enlightenmentAsset._id,
      );
    if (!karmaRxWallet || !enlightenmentRxWallet) {
      return {
        content: `You do not have a wallet that can receive ${
          this.gameAssets.karmaAsset.name
        } or ${this.gameAssets.enlightenmentAsset.name}\nCheck ${inlineCode(
          '/wallet',
        )} and ensure they have opted into the ${this.gameAssets.karmaAsset.name} and ${
          this.gameAssets.enlightenmentAsset.name
        } token.`,
        components: [walletButtonCreator()],
      };
    }
    const { shopEmbed, shopButtonRow } = karmaShopEmbedGenerator(
      databaseUser.artifactToken,
      karmaRxWallet.convertedTokens,
      enlightenmentRxWallet.convertedTokens,
      this.gameAssets.karmaAsset.name,
    );
    const message = await interaction.followUp({
      embeds: [shopEmbed],
      components: [shopButtonRow],
    });
    // Create the collector
    const collector = message.createMessageComponentCollector({
      max: 1,
      time: 10_000,
      componentType: ComponentType.Button,
    });
    collector.on('collect', (collectInteraction: ButtonInteraction) => {
      const handler = async (): Promise<void> => {
        await collectInteraction.deferUpdate();
        // Change the footer to say please wait and remove the buttons and fields
        shopEmbed.setColor('Gold');
        shopEmbed.spliceFields(0, 25);
        shopEmbed.setFooter({ text: 'Please wait...' });
        await collectInteraction.editReply({ embeds: [shopEmbed], components: [] });

        let claimStatus: TransactionResultOrError;
        let quantity = 1;
        switch (collectInteraction.customId) {
          case 'buyMaxArtifacts':
          case 'buyArtifact': {
            quantity = collectInteraction.customId.includes('buyMaxArtifacts')
              ? karmaShop.necessaryArtifacts
              : 1;
            // subtract the cost from the users wallet
            shopEmbed.setDescription('Buying an artifact...');
            await collectInteraction.editReply({
              embeds: [shopEmbed],
              components: [],
            });

            // Clawback the tokens and purchase the artifact
            claimStatus = await this.claimArtifact(
              collectInteraction,
              caller,
              quantity,
              karmaRxWallet.walletAddress,
            );

            if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
              shopEmbed.setImage(optimizedImageHostedUrl(OptimizedImages.ARTIFACT));
              shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Artifact', 'Claimed!'));
              shopEmbed.addFields(
                ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.transaction.txID()),
              );
            } else {
              shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Artifact', 'Error!'));
            }
            break;
          }
          case 'buyEnlightenment': {
            // subtract the cost from the users wallet
            shopEmbed.setDescription('Buying enlightenment...');
            await collectInteraction.editReply({
              embeds: [shopEmbed],
              components: [],
            });

            claimStatus = await this.claimEnlightenment(
              collectInteraction,
              caller,
              enlightenmentRxWallet.walletAddress,
            );
            if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
              shopEmbed.setImage(optimizedImageHostedUrl(OptimizedImages.ENLIGHTENMENT));
              shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Enlightenment', 'Claimed!'));
              shopEmbed.addFields(
                ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.transaction.txID()),
              );
            } else if (isTransferError(claimStatus)) {
              shopEmbed.addFields(
                ObjectUtil.singleFieldBuilder('Enlightenment', claimStatus.message),
              );
              shopEmbed.addFields({
                name: 'What Happened?',
                value: 'Contact an admin with this message, but its okay we can fix it!',
              });
            }
            break;
          }
        }
        shopEmbed.setDescription('Thank you for your purchase!');
        shopEmbed.setFooter({ text: 'Enjoy! | Come Back Again!' });
        await collectInteraction.editReply({
          embeds: [shopEmbed],
          components: [],
        });
      };
      handler().catch(print);
    });
    return;
  }
  @Guard(RateLimit(TIME_UNIT.minutes, 2, { ephemeral: true }), GameAssetsNeeded)
  async claimArtifact(
    _interaction: ButtonInteraction,
    caller: GuildMember,
    quantity: number = 1,
    rxWallet: ReceiverWalletAddress,
  ): Promise<TransactionResultOrError> {
    // Get the users RX wallet
    const claimUserId = caller.id as DiscordId;
    const totalArtifactCost = karmaShop.artifactCost * quantity;
    const claimStatus = await this.algorand.purchaseItem({
      assetIndex: this.gameAssets.karmaAsset._id,
      amount: totalArtifactCost,
      senderAddress: rxWallet,
    });
    if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
      // add the artifact to the users inventory
      await this.userService.updateUserArtifacts(claimUserId, quantity);
      karmaArtifactWebHook(claimStatus, caller);
    }
    return claimStatus;
  }
  @Guard(RateLimit(TIME_UNIT.minutes, 2, { ephemeral: true }), GameAssetsNeeded)
  async claimEnlightenment(
    _interaction: ButtonInteraction,
    caller: GuildMember,
    rxWallet: ReceiverWalletAddress,
  ): Promise<TransactionResultOrError> {
    // Get the users RX wallet
    const claimUserId = caller.id as DiscordId;
    const claimStatus = await this.algorand.claimToken({
      assetIndex: this.gameAssets.enlightenmentAsset._id,
      amount: 1,
      receiverAddress: rxWallet,
    });
    if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
      await this.userService.updateUserArtifacts(claimUserId, -karmaShop.necessaryArtifacts);
      karmaEnlightenmentWebHook(claimStatus, caller);
    }
    return claimStatus;
  }
}
