import {
  APIEmbedField,
  ButtonInteraction,
  CommandInteraction,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  inlineCode,
  InteractionReplyOptions,
} from 'discord.js';

import { Client } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { isTransferError } from '../services/algorand.errorprocessor.js';
import { GameAssets } from '../services/game-assets.js';
import { RewardsService } from '../services/rewards.js';
import { TransactionResultOrError } from '../types/algorand.js';
import { DiscordId, SenderWalletAddress } from '../types/core.js';
import type { ReceiverWalletAddress } from '../types/core.js';
import { ChannelUtils } from '../utils/classes/channel-utils.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';
import {
  buildYesNoButtons,
  claimTokenResponseEmbedUpdate,
  createSendAssetEmbed,
  createTransactionExplorerButton,
  humanFriendlyClaimStatus,
} from '../utils/functions/algo-embeds.js';
import { walletButtonCreator } from '../utils/functions/dt-embeds.js';
import { karmaSendWebHook, karmaTipWebHook } from '../utils/functions/web-hooks.js';

@injectable()
export class KarmaCommandService {
  constructor(
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(RewardsService) private rewardsService: RewardsService,
  ) {}
  async addKarma(discordId: DiscordId, amountToAdd: number): Promise<InteractionReplyOptions> {
    // ensure the amount is not negative
    const karmaAssetName = this.gameAssets.karmaAsset.name;
    if (amountToAdd < 0) {
      return { content: `Cannot add negative ${karmaAssetName}` };
    }

    let newTokens = 0;
    const walletWithMostTokens = await this.rewardsService.getRewardsTokenWalletWithMostTokens(
      discordId,
      this.gameAssets.karmaAsset._id,
    );
    if (walletWithMostTokens) {
      newTokens =
        (await this.rewardsService.issueTemporaryTokens(
          discordId,
          walletWithMostTokens.walletAddress,
          this.gameAssets.karmaAsset._id,
          amountToAdd,
        )) ?? 0;
    } else {
      return {
        content: `User does not have a wallet to add ${karmaAssetName} to`,
      };
    }
    return {
      content: `Added ${amountToAdd.toLocaleString()} ${karmaAssetName} (new balance): ${newTokens.toLocaleString()} to the users wallet.`,
    };
  }
  async dispenseAssetToUser(
    client: Client,
    interaction: CommandInteraction,
    receiver: GuildMember,
    sendingWhy: string,
    amount: number,
  ): Promise<InteractionReplyOptions> {
    try {
      // Ensure the user is not sending to a bot
      if (receiver.user.bot) {
        return { content: `You cannot send to a bot ${this.gameAssets.karmaAsset.name}` };
      }
      // Verify that the sending why is long enough to be worth it but not too long
      if (sendingWhy.length < 10 || sendingWhy.length > 200) {
        return {
          content: `You cannot send ${this.gameAssets.karmaAsset.name} with a reason less than 1 character or greater than 100 characters`,
        };
      }
      // Check if the user has a RX wallet
      const receiverWallet =
        await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
          receiver.id as DiscordId,
          this.gameAssets.karmaAsset._id,
        );

      if (!receiverWallet) {
        return {
          content: `The User you are attempting to send to does not have a wallet that can receive ${
            this.gameAssets.karmaAsset.name
          }\nHave them check ${inlineCode(
            '/wallet',
          )} and ensure they have opted into the ${this.gameAssets.karmaAsset.name} token.`,
          components: [walletButtonCreator()],
        };
      }
      const sender = await InteractionUtils.getInteractionCaller(interaction);

      // Build the embed to show that the tip is being processed
      const sendAssetEmbed = createSendAssetEmbed(
        this.gameAssets.karmaAsset.name,
        amount,
        sender.user,
        receiver,
        sendingWhy,
      );
      await InteractionUtils.replyOrFollowUp(interaction, { embeds: [sendAssetEmbed] });
      // Send the tip
      const sendTxn = await this.rewardsService.dispenseAssetToUser(
        this.gameAssets.karmaAsset._id,
        amount,
        receiverWallet.walletAddress,
      );
      claimTokenResponseEmbedUpdate(
        sendAssetEmbed,
        this.gameAssets.karmaAsset.name,
        sendTxn,
        receiver,
      );
      const components = [];
      if (!isTransferError(sendTxn) && sendTxn.transaction.txID()) {
        karmaSendWebHook(sendTxn, receiver, sender);
        components.push(createTransactionExplorerButton(sendTxn.transaction.txID()));
        const adminChannelMessage = `Sent ${sendTxn.transaction.amount.toLocaleString()} ${this.gameAssets.karmaAsset.name} from ${sender.user.username} (${sender.id}) to ${
          receiver.user.username
        } (${receiver.id}) Reason: ${sendingWhy}`;
        await ChannelUtils.sendMessageToAdminChannel(adminChannelMessage, client);
      } else {
        if (isTransferError(sendTxn)) {
          sendAssetEmbed.setDescription(sendTxn.message);
        }
      }
      return { embeds: [sendAssetEmbed], components };
    } catch {
      return {
        content: `There was a problem sending ${
          this.gameAssets.karmaAsset.name
        } to ${receiver.toString()} `,
      };
    }
  }
  async tipAsset(
    interaction: CommandInteraction,
    tipReceiver: GuildMember,
    tipSender: GuildMember,
    amount: number,
  ): Promise<InteractionReplyOptions> {
    try {
      // Ensure the user is not tipping themselves
      if (tipReceiver.id === tipSender.id) {
        return { content: `You cannot tip yourself ${this.gameAssets.karmaAsset.name}` };
      }
      // Ensure the user is not tipping a bot
      if (tipReceiver.user.bot) {
        return { content: `You cannot tip a bot ${this.gameAssets.karmaAsset.name}` };
      }
      // Check if the user has a RX wallet
      const tipReceiverWallet =
        await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
          tipReceiver.id as DiscordId,
          this.gameAssets.karmaAsset._id,
        );

      if (!tipReceiverWallet) {
        return {
          content: `The User you are attempting to Tip does not have a wallet that can receive ${
            this.gameAssets.karmaAsset.name
          }\nHave them check ${inlineCode(
            '/wallet',
          )} and ensure they have opted into the ${this.gameAssets.karmaAsset.name} token.`,
          components: [walletButtonCreator()],
        };
      }
      // Build the embed to show that the tip is being processed
      const tipAssetEmbed = createSendAssetEmbed(
        this.gameAssets.karmaAsset.name,
        amount,
        tipSender.user,
        tipReceiver,
      );
      await InteractionUtils.replyOrFollowUp(interaction, {
        embeds: [tipAssetEmbed],
      });
      // Send the tip
      const callerRxWallet =
        await this.rewardsService.getRewardsTokenWalletWithMostTokens<SenderWalletAddress>(
          tipSender.id as DiscordId,
          this.gameAssets.karmaAsset._id,
        );
      if (!callerRxWallet) {
        throw new Error('Caller Wallet Not Found');
      }
      const tipTxn = await this.rewardsService.tipTokens(
        this.gameAssets.karmaAsset._id,
        amount,
        tipReceiverWallet.walletAddress,
        callerRxWallet.walletAddress,
      );
      claimTokenResponseEmbedUpdate(
        tipAssetEmbed,
        this.gameAssets.karmaAsset.name,
        tipTxn,
        tipReceiver,
      );
      const components = [];
      if (!isTransferError(tipTxn) && tipTxn.transaction.txID()) {
        karmaTipWebHook(tipTxn, tipReceiver, tipSender);
        components.push(createTransactionExplorerButton(tipTxn.transaction.txID()));
      }
      return {
        embeds: [tipAssetEmbed],
        components,
      };
    } catch {
      return {
        content: `There was a problem sending ${tipReceiver.toString()} ${
          this.gameAssets.karmaAsset.name
        }`,
      };
    }
  }
  async claimAsset(interaction: CommandInteraction): Promise<InteractionReplyOptions | undefined> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);

    const walletsWithUnclaimedKarma =
      await this.rewardsService.getWalletsByUserAndAssetWithUnclaimedTokens(
        caller.id as DiscordId,
        this.gameAssets.karmaAsset._id,
      );
    if (walletsWithUnclaimedKarma.length === 0) {
      return { content: `You do not have any ${this.gameAssets.karmaAsset.name} to claim!` };
    }
    // filter out any opted in wallet that does not have unclaimed KARMA
    const claimEmbedConfirm = new EmbedBuilder();

    // build string of wallets with unclaimed KARMA
    for (const wallet of walletsWithUnclaimedKarma) {
      claimEmbedConfirm.addFields(
        ObjectUtil.singleFieldBuilder(
          ObjectUtil.ellipseAddress(wallet.walletAddress),
          `${wallet.temporaryTokens.toLocaleString()} ${this.gameAssets.karmaAsset.name}`,
          true,
        ),
      );
    }

    claimEmbedConfirm.setTitle(`Claim ${this.gameAssets.karmaAsset.name}`);
    const oneWallet = `\n\nYou have 1 wallet with unclaimed KARMA`;
    const greaterThanOneWallet = `\n\nYou have ${walletsWithUnclaimedKarma.length} wallets with unclaimed KARMA\n\nThere will be ${walletsWithUnclaimedKarma.length} transfers to complete these claims.\n\n`;
    const walletDesc = walletsWithUnclaimedKarma.length > 1 ? greaterThanOneWallet : oneWallet;
    claimEmbedConfirm.setDescription(
      `__**Are you sure you want to claim ${this.gameAssets.karmaAsset.name}?**__${walletDesc}`,
    );
    const buttonRow = buildYesNoButtons('claim');
    const message = await interaction.followUp({
      components: [buttonRow],
      embeds: [claimEmbedConfirm],
    });
    const claimEmbed = new EmbedBuilder();
    claimEmbed.setTitle(`Claim ${this.gameAssets.karmaAsset.name}`);
    const claimEmbedFields: APIEmbedField[] = [];

    // Create the Collector for the button
    const collector = message.createMessageComponentCollector({
      max: 1,
      time: 10_000,
      componentType: ComponentType.Button,
    });

    // Handle the button click
    collector.on('collect', async (collectInteraction: ButtonInteraction) => {
      await collectInteraction.deferUpdate();
      await collectInteraction.editReply({
        components: [],
        embeds: [],
        content: `${this.gameAssets.karmaAsset.name} claim check in progress...`,
      });
      let claimStatus: TransactionResultOrError;
      if (collectInteraction.customId.includes('no')) {
        claimEmbed.setDescription('No problem! Come back when you are ready!');
        return;
      }
      let components;
      if (collectInteraction.customId.includes('yes')) {
        await collectInteraction.editReply({
          content: `Claiming ${this.gameAssets.karmaAsset.name}...`,
        });
        // Create claim response embed looping through wallets with unclaimed KARMA
        for (const wallet of walletsWithUnclaimedKarma) {
          claimStatus = await this.rewardsService.claimUnclaimedTokens(
            {
              discordUserId: wallet.discordUserId,
              unclaimedTokens: wallet.temporaryTokens,
              walletAddress: wallet.walletAddress as ReceiverWalletAddress,
            },
            this.gameAssets.karmaAsset,
          );
          if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
            components = [createTransactionExplorerButton(claimStatus.transaction.txID())];
            const hfClaimStatus = humanFriendlyClaimStatus(claimStatus);
            claimEmbedFields.push(
              {
                name: 'Txn ID',
                value: hfClaimStatus.txId,
              },
              {
                name: 'Txn Hash',
                value: hfClaimStatus.confirmedRound,
              },
              {
                name: 'Transaction Amount',
                value: hfClaimStatus.transactionAmount,
              },
            );
          } else {
            claimEmbedFields.push({
              name: 'Error',
              value: JSON.stringify(claimStatus),
            });
          }
        }
        claimEmbed.addFields(claimEmbedFields);
      }
      await collectInteraction.editReply({
        content: '',
        embeds: [claimEmbed],
        components: components ?? [],
      });
    });
    return;
  }
}
