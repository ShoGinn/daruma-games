import { randomInt } from 'node:crypto';

import {
  ActionRowBuilder,
  APIEmbedField,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  inlineCode,
} from 'discord.js';

import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { ButtonComponent, Client, Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { getConfig } from '../config/config.js';
import { AlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { Reward } from '../database/rewards/rewards.schema.js';
import { Schedule } from '../decorators/schedule.js';
import { OptimizedImages } from '../enums/daruma-training.js';
import { GameAssetsNeeded } from '../guards/game-assets-needed.js';
import { TenorImageManager } from '../manager/tenor-image.js';
import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { Algorand } from '../services/algorand.js';
import { GameAssets } from '../services/game-assets.js';
import { RewardsService } from '../services/rewards.js';
import { UserService } from '../services/user.js';
import { ClaimTokenResponse } from '../types/algorand.js';
import {
  DiscordId,
  ReceiverWalletAddress,
  SenderWalletAddress,
  WalletAddress,
} from '../types/core.js';
import {
  buildYesNoButtons,
  claimTokenResponseEmbedUpdate,
  createAlgoExplorerButton,
  createSendAssetEmbed,
  humanFriendlyClaimStatus,
} from '../utils/functions/algo-embeds.js';
import { assetName } from '../utils/functions/dt-embeds.js';
import { emojiConvert } from '../utils/functions/dt-emojis.js';
import { optimizedImageHostedUrl } from '../utils/functions/dt-images.js';
import logger from '../utils/functions/logger-factory.js';
import {
  karmaArtifactWebHook,
  karmaClaimWebHook,
  karmaElixirWebHook,
  karmaEnlightenmentWebHook,
  karmaSendWebHook,
  karmaTipWebHook,
} from '../utils/functions/web-hooks.js';
import {
  getDeveloperMentions,
  InteractionUtils,
  ObjectUtil,
  sendMessageToAdminChannel,
} from '../utils/utils.js';

@Discord()
@injectable()
@Category('Karma')
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
@SlashGroup({ description: 'Admin Commands', name: 'admin' })
export default class KarmaCommand {
  constructor(
    @inject(Algorand) private algorand: Algorand,
    @inject(TenorImageManager) private tenorManager: TenorImageManager,
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(UserService) private userService: UserService,
    @inject(AlgoNFTAssetService) private algoNftService: AlgoNFTAssetService,
    @inject(RewardsService) private rewardsService: RewardsService,
    private client: Client,
  ) {}
  private replenishTokenAccount = getConfig().get('replenishTokenAccount') as SenderWalletAddress;
  // Setup the number of artifacts necessary to reach enlightenment
  private noArmsOrLegs = true;
  private necessaryArtifacts = 4; // two arms and two legs
  private artifactCost = 2500;
  // Elixir Item Costs
  private itemElixirBase = 15;
  private uptoFiveCoolDown = this.itemElixirBase * 5;
  private uptoTenCoolDown = this.itemElixirBase * 10;
  private uptoFifteenCoolDown = this.itemElixirBase * 15;

  /**
   * Administrator Command to add KARMA to a user
   *
   * @param {GuildMember} karmaAddUser
   * @param {number} amount
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof KarmaCommand
   */
  @Guard(PermissionGuard(['Administrator']), GameAssetsNeeded)
  @Slash({
    description: 'Add Karma to a user (they still have to claim!)',
    name: 'add_karma',
  })
  @Category('Admin')
  @SlashGroup('admin')
  async add(
    @SlashOption({
      description: 'Discord User',
      name: 'username',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    karmaAddUser: GuildMember,
    @SlashOption({
      description: 'Amount To Add',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    amount: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const caller = await InteractionUtils.getInteractionCaller(interaction);
    // ensure the amount is not negative
    if (amount < 0) {
      await InteractionUtils.replyOrFollowUp(
        interaction,
        `You cannot add negative ${this.gameAssets.karmaAsset?.name}`,
      );
      return;
    }
    const karmaAddUserId = karmaAddUser.id as DiscordId;

    let newTokens = 0;
    const walletWithMostTokens = await this.rewardsService.getRewardsTokenWalletWithMostTokens(
      karmaAddUserId,
      this.gameAssets.karmaAsset!._id,
    );
    if (walletWithMostTokens) {
      newTokens =
        (await this.rewardsService.issueTemporaryTokens(
          karmaAddUserId,
          walletWithMostTokens.walletAddress,
          this.gameAssets.karmaAsset!._id,
          amount,
        )) ?? 0;
    } else {
      await InteractionUtils.replyOrFollowUp(
        interaction,
        `User ${karmaAddUser.toString()} does not have a wallet to add ${this.gameAssets.karmaAsset
          ?.name} to`,
      );
      return;
    }

    // Provide an audit log of who added karma and to who
    logger.warn(
      `${caller.user.username} added ${amount} ${this.gameAssets.karmaAsset?.name} to ${karmaAddUser.user.username}`,
    );
    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Added ${amount.toLocaleString()} ${this.gameAssets.karmaAsset
        ?.name} to ${karmaAddUser.toString()} -- Now has ${newTokens.toLocaleString()} ${this
        .gameAssets.karmaAsset?.name}`,
    );
  }
  /**
   * This is the command to SEND Karma to a user
   *
   * @param {GuildMember} sendToUser
   * @param {number} karmaAmount
   * @param {string} sendingWhy
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof KarmaCommand
   */
  @Guard(PermissionGuard(['Administrator']), GameAssetsNeeded)
  @Slash({
    description: 'Send Karma Immediately to a user (they do not have to claim!)',
    name: 'send',
  })
  @Category('Admin')
  @SlashGroup('karma')
  async send(
    @SlashOption({
      description: 'Send Karma to Who?',
      name: 'username',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    sendToUser: GuildMember,
    @SlashOption({
      description: 'How Much are you Sending? (Bot uses the wallet with the most KARMA)',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    karmaAmount: number,
    @SlashOption({
      description:
        'Why are you sending this - for audit purposes (keep between 10 and 200 characters)',
      name: 'why',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    sendingWhy: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const caller = await InteractionUtils.getInteractionCaller(interaction);
    // get the caller's wallet

    try {
      // Ensure the user is not sending to a bot
      if (sendToUser.user.bot) {
        await InteractionUtils.replyOrFollowUp(
          interaction,
          `You cannot send to a bot ${this.gameAssets.karmaAsset?.name}`,
        );
        return;
      }
      // Verify that the sending why is long enough to be worth it but not too long
      if (sendingWhy.length < 10 || sendingWhy.length > 200) {
        await InteractionUtils.replyOrFollowUp(
          interaction,
          `You cannot send ${this.gameAssets.karmaAsset?.name} with a reason less than 1 character or greater than 100 characters`,
        );
        return;
      }
      // Check if the user has a RX wallet
      const sendToUserRxWallet =
        await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
          sendToUser.id as DiscordId,
          this.gameAssets.karmaAsset!._id,
        );

      if (!sendToUserRxWallet) {
        await InteractionUtils.replyOrFollowUp(interaction, {
          content: `The User you are attempting to send to does not have a wallet that can receive ${this
            .gameAssets.karmaAsset?.name}\nHave them check ${inlineCode(
            '/wallet',
          )} and ensure they have opted into the ${this.gameAssets.karmaAsset?.name} token.`,
          components: [this.walletButtonCreator()],
        });
        return;
      }
      // Build the embed to show that the tip is being processed
      const sendAssetEmbed = createSendAssetEmbed(
        this.gameAssets.karmaAsset!.name,
        karmaAmount,
        caller.user,
        sendToUser,
        sendingWhy,
      );
      await InteractionUtils.replyOrFollowUp(interaction, {
        embeds: [sendAssetEmbed],
      });
      // Send the tip
      let sendTxn: ClaimTokenResponse = {};
      try {
        sendTxn = await this.algorand.claimToken({
          assetIndex: this.gameAssets.karmaAsset!._id,
          amount: karmaAmount,
          receiverAddress: sendToUserRxWallet.walletAddress,
        });
      } catch {
        logger.error(
          `Error sending ${karmaAmount} ${this.gameAssets.karmaAsset?.name} from ${caller.user.username} (${caller.id}) to ${sendToUser.user.username} (${sendToUser.id})`,
        );
      }
      claimTokenResponseEmbedUpdate(
        sendAssetEmbed,
        this.gameAssets.karmaAsset!.name,
        sendTxn,
        sendToUser,
      );
      const components = [];
      if (sendTxn.txId) {
        karmaSendWebHook(sendTxn, sendToUser, caller);
        components.push(createAlgoExplorerButton(sendTxn.txId));
        const adminChannelMessage = `Sent ${
          sendTxn.status?.txn.txn.aamt?.toLocaleString() ?? ''
        } ${this.gameAssets.karmaAsset?.name} from ${caller.user.username} (${caller.id}) to ${
          sendToUser.user.username
        } (${sendToUser.id}) Reason: ${sendingWhy}`;
        await sendMessageToAdminChannel(adminChannelMessage, this.client);
      }
      await InteractionUtils.replyOrFollowUp(interaction, {
        embeds: [sendAssetEmbed],
        components,
      });
    } catch {
      await InteractionUtils.replyOrFollowUp(
        interaction,
        `The User ${sendToUser.toString()} you are attempting to send to cannot receive ${this
          .gameAssets.karmaAsset?.name} because they have not registered.`,
      );
      return;
    }
  }

  /**
   * This is the TIP command
   *
   * @param {GuildMember} tipUser
   * @param {number} karmaAmount
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof KarmaCommand
   */
  @Slash({
    name: 'tip',
    description: 'Tip Someone some KARMA -- So Kind of You!',
  })
  @SlashGroup('karma')
  @Guard(RateLimit(TIME_UNIT.minutes, 1), GameAssetsNeeded)
  async tip(
    @SlashOption({
      description: 'Who To Tip?',
      name: 'username',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    tipUser: GuildMember,
    @SlashOption({
      description: 'How Much are you Tipping? (Bot uses the wallet with the most KARMA)',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    karmaAmount: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const caller = await InteractionUtils.getInteractionCaller(interaction);
    // get the caller's wallet

    try {
      // Ensure the user is not tipping themselves
      if (tipUser.id === caller.id) {
        await InteractionUtils.replyOrFollowUp(
          interaction,
          `You cannot tip yourself ${this.gameAssets.karmaAsset?.name}`,
        );
        return;
      }
      // Ensure the user is not tipping a bot
      if (tipUser.user.bot) {
        await InteractionUtils.replyOrFollowUp(
          interaction,
          `You cannot tip a bot ${this.gameAssets.karmaAsset?.name}`,
        );
        return;
      }
      // Check if the user has a RX wallet
      const tipUserRxWallet =
        await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
          tipUser.id as DiscordId,
          this.gameAssets.karmaAsset!._id,
        );

      if (!tipUserRxWallet) {
        await InteractionUtils.replyOrFollowUp(interaction, {
          content: `The User you are attempting to Tip does not have a wallet that can receive ${this
            .gameAssets.karmaAsset?.name}\nHave them check ${inlineCode(
            '/wallet',
          )} and ensure they have opted into the ${this.gameAssets.karmaAsset?.name} token.`,
          components: [this.walletButtonCreator()],
        });
        return;
      }
      // Build the embed to show that the tip is being processed
      const tipAssetEmbed = createSendAssetEmbed(
        this.gameAssets.karmaAsset!.name,
        karmaAmount,
        caller.user,
        tipUser,
      );
      await InteractionUtils.replyOrFollowUp(interaction, {
        embeds: [tipAssetEmbed],
      });
      // Send the tip
      const callerRxWallet =
        await this.rewardsService.getRewardsTokenWalletWithMostTokens<SenderWalletAddress>(
          caller.id as DiscordId,
          this.gameAssets.karmaAsset!._id,
        );
      if (!callerRxWallet) {
        throw new Error('Caller Wallet Not Found');
      }
      const tipTxn = await this.algorand.tipToken({
        assetIndex: this.gameAssets.karmaAsset!._id,
        amount: karmaAmount,
        receiverAddress: tipUserRxWallet.walletAddress,
        senderAddress: callerRxWallet.walletAddress,
      });
      claimTokenResponseEmbedUpdate(
        tipAssetEmbed,
        this.gameAssets.karmaAsset!.name,
        tipTxn,
        tipUser,
      );
      const components = [];
      if (tipTxn.txId) {
        karmaTipWebHook(tipTxn, tipUser, caller);
        components.push(createAlgoExplorerButton(tipTxn.txId));
      }
      await InteractionUtils.replyOrFollowUp(interaction, {
        embeds: [tipAssetEmbed],
        components,
      });
    } catch {
      await InteractionUtils.replyOrFollowUp(
        interaction,
        `The User ${tipUser.toString()} you are attempting to tip cannot receive ${this.gameAssets
          .karmaAsset?.name} because they have not registered.`,
      );
      return;
    }
  }

  /**
   * Claim your KARMA
   *
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof KarmaCommand
   */
  @Slash({
    name: 'claim',
    description: 'Claim your KARMA',
  })
  @Guard(RateLimit(TIME_UNIT.minutes, 2), GameAssetsNeeded)
  async karmaClaim(interaction: CommandInteraction): Promise<void> {
    await this.claim(interaction);
  }

  @Slash({
    name: 'claim',
    description: 'Claim your KARMA',
  })
  @SlashGroup('karma')
  @Guard(RateLimit(TIME_UNIT.minutes, 2), GameAssetsNeeded)
  async claim(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const optedInWallets = await this.getOptedInWallets(interaction, this.gameAssets.karmaAsset!);
    if (!optedInWallets) {
      return;
    }
    // filter out any opted in wallet that does not have unclaimed KARMA
    const walletsWithUnclaimedKarma: Reward[] = [];
    for (const wallet of optedInWallets) {
      if (wallet.temporaryTokens > 0) {
        walletsWithUnclaimedKarma.push(wallet);
      }
    }
    const walletsWithUnclaimedKarmaFields: APIEmbedField[] = [];

    if (walletsWithUnclaimedKarma.length > 0) {
      // build string of wallets with unclaimed KARMA
      for (const wallet of walletsWithUnclaimedKarma) {
        walletsWithUnclaimedKarmaFields.push({
          name: ObjectUtil.ellipseAddress(wallet.walletAddress),
          value: `${wallet.temporaryTokens.toLocaleString()} ${this.gameAssets.karmaAsset?.name}`,
          inline: true,
        });
      }
    } else {
      await InteractionUtils.replyOrFollowUp(
        interaction,
        `You don't have any ${this.gameAssets.karmaAsset?.name} to claim!`,
      );
      return;
    }

    const claimEmbedConfirm = new EmbedBuilder();
    claimEmbedConfirm.setTitle(`Claim ${this.gameAssets.karmaAsset?.name}`);
    const oneWallet = `\n\nYou have 1 wallet with unclaimed KARMA`;
    const greaterThanOneWallet = `\n\nYou have ${walletsWithUnclaimedKarma.length} wallets with unclaimed KARMA\n\nThere will be ${walletsWithUnclaimedKarma.length} transfers to complete these claims.\n\n`;
    const walletDesc = walletsWithUnclaimedKarma.length > 1 ? greaterThanOneWallet : oneWallet;
    claimEmbedConfirm.setDescription(
      `__**Are you sure you want to claim ${this.gameAssets.karmaAsset?.name}?**__${walletDesc}`,
    );
    claimEmbedConfirm.addFields(walletsWithUnclaimedKarmaFields);
    const buttonRow = buildYesNoButtons('claim');
    const message = await interaction.followUp({
      components: [buttonRow],
      embeds: [claimEmbedConfirm],
    });
    const claimEmbed = new EmbedBuilder();
    claimEmbed.setTitle(`Claim ${this.gameAssets.karmaAsset?.name}`);
    const claimEmbedFields: APIEmbedField[] = [];
    const collector = message.createMessageComponentCollector({
      max: 1,
      time: 10_000,
      componentType: ComponentType.Button,
    });
    collector.on('collect', async (collectInteraction: ButtonInteraction) => {
      await collectInteraction.deferUpdate();
      await collectInteraction.editReply({
        components: [],
        embeds: [],
        content: `${this.gameAssets.karmaAsset?.name} claim check in progress...`,
      });
      let claimStatus: ClaimTokenResponse = {};
      if (collectInteraction.customId.includes('yes')) {
        await collectInteraction.editReply({
          content: `Claiming ${this.gameAssets.karmaAsset?.name}...`,
        });
        // Create claim response embed looping through wallets with unclaimed KARMA
        for (const wallet of walletsWithUnclaimedKarma) {
          claimStatus = await this.algorand.claimToken({
            assetIndex: this.gameAssets.karmaAsset!._id,
            amount: wallet.temporaryTokens,
            receiverAddress: wallet.walletAddress as ReceiverWalletAddress,
          });
          // remove unclaimed tokens from db
          await this.rewardsService.issueTemporaryTokens(
            caller.id as DiscordId,
            wallet.walletAddress,
            this.gameAssets.karmaAsset!._id,
            -wallet.temporaryTokens,
          );
          if (claimStatus.txId) {
            const hfClaimStatus = humanFriendlyClaimStatus(claimStatus);
            logger.info(
              `Claimed ${hfClaimStatus.transactionAmount} ${this.gameAssets.karmaAsset?.name} for ${caller.user.username} (${caller.id})`,
            );
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
            karmaClaimWebHook(claimStatus, caller);
          } else {
            // give back unclaimed tokens
            await this.rewardsService.issueTemporaryTokens(
              caller.id as DiscordId,
              wallet.walletAddress,
              this.gameAssets.karmaAsset!._id,
              wallet.temporaryTokens,
            );
            claimEmbedFields.push({
              name: 'Error',
              value: JSON.stringify(claimStatus),
            });
          }
        }
        claimEmbed.addFields(claimEmbedFields);
      }
      if (collectInteraction.customId.includes('no')) {
        claimEmbed.setDescription('No problem! Come back when you are ready!');
      }
      // check for button
      const components = claimStatus.txId ? [createAlgoExplorerButton(claimStatus.txId)] : [];
      await collectInteraction.editReply({
        content: '',
        embeds: [claimEmbed],
        components,
      });
    });
  }

  /**
   * This is the Karma Shop
   *
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof KarmaCommand
   */
  @Slash({
    description: 'Shop at the Karma Store',
    name: 'shop',
  })
  @SlashGroup('karma')
  @Guard(GameAssetsNeeded)
  async shop(interaction: CommandInteraction): Promise<void> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);

    await interaction.deferReply({ ephemeral: true });

    // Get the shop embed
    const karmaOptedIn = await this.getOptedInWallets(interaction, this.gameAssets.karmaAsset!);
    if (!karmaOptedIn) {
      return;
    }
    const enlightenmentOptedIn = await this.getOptedInWallets(
      interaction,
      this.gameAssets.enlightenmentAsset!,
    );
    if (!enlightenmentOptedIn) {
      return;
    }

    const { shopEmbed, shopButtonRow } = await this.shopEmbed(caller.id as DiscordId);
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
    collector.on('collect', async (collectInteraction: ButtonInteraction) => {
      await collectInteraction.deferUpdate();
      // Change the footer to say please wait and remove the buttons and fields
      shopEmbed.setColor('Gold');
      shopEmbed.spliceFields(0, 25);
      shopEmbed.setFooter({ text: 'Please wait...' });
      await collectInteraction.editReply({
        embeds: [shopEmbed],
        components: [],
      });

      let claimStatus: ClaimTokenResponse;
      let quantity = 1;
      switch (collectInteraction.customId) {
        case 'buyMaxArtifacts':
        case 'buyArtifact': {
          quantity = collectInteraction.customId.includes('buyMaxArtifacts')
            ? this.necessaryArtifacts
            : 1;
          // subtract the cost from the users wallet
          shopEmbed.setDescription('Buying an artifact...');
          await collectInteraction.editReply({
            embeds: [shopEmbed],
            components: [],
          });

          // Clawback the tokens and purchase the artifact
          claimStatus = await this.claimArtifact(collectInteraction, caller, quantity);

          if (claimStatus.txId) {
            shopEmbed.setImage(optimizedImageHostedUrl(OptimizedImages.ARTIFACT));
            shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Artifact', 'Claimed!'));
            shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.txId));
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

          claimStatus = await this.claimEnlightenment(collectInteraction, caller);
          if (claimStatus.txId) {
            shopEmbed.setImage(optimizedImageHostedUrl(OptimizedImages.ENLIGHTENMENT));
            shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Enlightenment', 'Claimed!'));
            shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Txn ID', claimStatus.txId));
          } else {
            shopEmbed.addFields(ObjectUtil.singleFieldBuilder('Enlightenment', 'Error!'));
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
    });
  }

  /**
   * This is how you claim an artifact
   *
   * @param {ButtonInteraction} _interaction
   * @param {GuildMember} caller
   * @param {number} [quantity=1]
   * @returns {*}  {Promise<ClaimTokenResponse>}
   * @memberof KarmaCommand
   */
  @Guard(RateLimit(TIME_UNIT.minutes, 2), GameAssetsNeeded)
  async claimArtifact(
    _interaction: ButtonInteraction,
    caller: GuildMember,
    quantity: number = 1,
  ): Promise<ClaimTokenResponse> {
    // Get the users RX wallet
    const claimUserId = caller.id as DiscordId;
    const rxWallet =
      await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
        claimUserId,
        this.gameAssets.karmaAsset!._id,
      );
    if (!rxWallet) {
      throw new Error('No Wallets Opted In');
    }
    const totalArtifactCost = this.artifactCost * quantity;
    const claimStatus = await this.algorand.purchaseItem({
      assetIndex: this.gameAssets.karmaAsset!._id,
      amount: totalArtifactCost,
      senderAddress: rxWallet.walletAddress,
    });
    const plural = quantity > 1 ? 's' : '';
    if (claimStatus.txId) {
      logger.info(
        `${quantity} Artifact${plural} Purchased ${claimStatus.status?.txn.txn.aamt ?? ''} ${this
          .gameAssets.karmaAsset?.name} for ${caller.user.username} (${caller.id})`,
      );
      // add the artifact to the users inventory
      await this.userService.updateUserArtifacts(claimUserId, quantity);
      karmaArtifactWebHook(claimStatus, caller);
    }
    return claimStatus;
  }
  /**
   * Karma Shop Enlightenment Purchase
   *
   * @param {ButtonInteraction} _interaction
   * @param {GuildMember} caller
   * @returns {*}  {Promise<ClaimTokenResponse>}
   * @memberof KarmaCommand
   */
  @Guard(RateLimit(TIME_UNIT.minutes, 2), GameAssetsNeeded)
  async claimEnlightenment(
    _interaction: ButtonInteraction,
    caller: GuildMember,
  ): Promise<ClaimTokenResponse> {
    // Get the users RX wallet
    const claimUserId = caller.id as DiscordId;
    const rxWallet =
      await this.rewardsService.getRewardsTokenWalletWithMostTokens<ReceiverWalletAddress>(
        claimUserId,
        this.gameAssets.enlightenmentAsset!._id,
      );
    if (!rxWallet) {
      logger.error(`Enlightenment Purchase Failed for ${caller.user.username} (${caller.id})`);
      return { txId: '' };
    }
    const claimStatus = await this.algorand.claimToken({
      assetIndex: this.gameAssets.enlightenmentAsset!._id,
      amount: 1,
      receiverAddress: rxWallet.walletAddress,
    });
    if (claimStatus.txId) {
      logger.info(
        `Enlightenment Purchased ${claimStatus.status?.txn?.txn?.aamt ?? ''} ${
          this.gameAssets.enlightenmentAsset!.name
        } for ${caller.user.username} (${caller.id})`,
      );
      await this.userService.updateUserArtifacts(claimUserId, -this.necessaryArtifacts);
      karmaEnlightenmentWebHook(claimStatus, caller);
    }
    return claimStatus;
  }

  /**
   * The Karma Shop Embed
   *
   * @param {string} discordUserId
   * @returns {*}  {Promise<{
   *         shopEmbed: EmbedBuilder;
   *         shopButtonRow: ActionRowBuilder<ButtonBuilder>;
   *     }>}
   * @memberof KarmaCommand
   */
  async shopEmbed(discordUserId: DiscordId): Promise<{
    shopEmbed: EmbedBuilder;
    shopButtonRow: ActionRowBuilder<ButtonBuilder>;
  }> {
    // Get unclaimed karma
    const user = await this.userService.getUserByID(discordUserId);
    const userClaimedKarmaWallet = await this.rewardsService.getRewardsTokenWalletWithMostTokens(
      discordUserId,
      this.gameAssets.karmaAsset!._id,
    );
    if (!userClaimedKarmaWallet) {
      throw new Error('No Wallets Opted In Karma');
    }
    const userClaimedEnlightenmentWallet =
      await this.rewardsService.getRewardsTokenWalletWithMostTokens(
        discordUserId,
        this.gameAssets.enlightenmentAsset!._id,
      );
    const userClaimedKarma = userClaimedKarmaWallet.convertedTokens;
    const unclaimedKarma = userClaimedKarmaWallet.temporaryTokens;
    // total pieces are the total number of artifacts the user has and arms are the first 2 artifacts and legs are the last 2 artifacts
    const totalPieces = user.artifactToken;
    const totalEnlightened = userClaimedEnlightenmentWallet?.convertedTokens ?? 0;
    // Set the total legs and arms and then calculate the individual pieces based on the total pieces
    let totalLegs = 0;
    let totalArms = 0;

    if (totalPieces > 0) {
      if (totalPieces % 2 == 0) {
        totalLegs = totalPieces / 2;
        totalArms = totalPieces / 2;
      } else {
        totalLegs = (totalPieces - 1) / 2;
        totalArms = (totalPieces + 1) / 2;
      }
    }
    const armsAndLegsFields: APIEmbedField[] = [
      {
        name: 'Arms Gathered',
        value: emojiConvert(totalArms.toString()),
        inline: true,
      },
      {
        name: 'Legs Gathered',
        value: emojiConvert(totalLegs.toString()),
        inline: true,
      },
    ];
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
    if (userClaimedKarma >= this.artifactCost || totalPieces >= this.necessaryArtifacts) {
      shopEmbed.setColor('Green');
    } else {
      shopEmbed.setColor('Red');
    }
    shopEmbed.setTitle(`Welcome to The ${this.gameAssets.karmaAsset?.name} Shop`);
    shopEmbed.setImage(optimizedImageHostedUrl(OptimizedImages.SHOP));
    shopEmbed.setFooter({
      text: `To claim your ${this.gameAssets.karmaAsset?.name} use ${inlineCode(
        '/karma claim',
      )}\nDon't see what you expect? Use ${inlineCode('/wallet')} to verify.`,
    });
    shopEmbed.setDescription(
      `Here you can use ${this.gameAssets.karmaAsset
        ?.name} to achieve enlightenment!\n\n**To reach enlightenment you must gather ${emojiConvert(
        this.necessaryArtifacts.toString(),
      )} artifacts**\n\n__Each artifact costs ${this.artifactCost.toLocaleString()} ${this
        .gameAssets.karmaAsset?.unitName}__\n\n*Your ${this.gameAssets.karmaAsset
        ?.name} must be claimed and in the Algorand network before you can spend it!*\n\nYou currently have ${inlineCode(
        userClaimedKarma.toLocaleString(),
      )} ${this.gameAssets.karmaAsset?.unitName} -- _${inlineCode(
        unclaimedKarma.toLocaleString(),
      )} unclaimed_`,
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

    if (userClaimedKarma >= this.artifactCost) {
      buyArtifactButton.setDisabled(false);
    }
    // add either arms and legs or just artifacts to an embed
    const shopEmbedFields = this.noArmsOrLegs ? [justArtifactsField] : armsAndLegsFields;
    // add enlightenment to the embed
    shopEmbedFields.push(enlightenMentField);

    if (totalPieces >= this.necessaryArtifacts && userClaimedEnlightenmentWallet?.asaId) {
      buyEnlightenmentButton.setDisabled(false);
      // Add a field to show how many enlightenments they are eligible for
      const enlightenments = Math.floor(totalPieces / this.necessaryArtifacts);
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
    if (userClaimedKarma >= this.artifactCost * this.necessaryArtifacts) {
      const buyMaxArtifactButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setLabel(`Buy ${this.necessaryArtifacts} Artifacts`)
        .setCustomId('buyMaxArtifacts');
      shopButtonRow.addComponents(buyMaxArtifactButton);
    }
    shopButtonRow.addComponents(buyArtifactButton, buyEnlightenmentButton);

    return { shopEmbed, shopButtonRow };
  }
  @ButtonComponent({ id: 'randomCoolDownOffer' })
  @Guard(GameAssetsNeeded)
  async shadyShop(interaction: ButtonInteraction): Promise<void> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);

    await interaction.deferReply({ ephemeral: true });

    // Get the shop embed
    const { shadyEmbeds, shadyComponents, content } = await this.shadyShopEmbed(
      caller.id as DiscordId,
    );
    if (content) {
      await InteractionUtils.replyOrFollowUp(interaction, { content });
      return;
    }
    if (!shadyEmbeds || !shadyComponents) {
      await InteractionUtils.replyOrFollowUp(interaction, {
        content: 'Something went wrong, please try again later.',
      });
      return;
    }
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
          elixirPrice = this.uptoFiveCoolDown;
          numberOfCoolDowns = randomInt(3, 5);
          break;
        }
        case 'uptoTenCoolDown': {
          // subtract the cost from the users wallet
          shadyEmbeds.setDescription('Buying an elixir for 10 cool downs... yeah 10 cool downs...');
          elixirPrice = this.uptoTenCoolDown;
          numberOfCoolDowns = randomInt(5, 10);
          break;
        }
        case 'uptoFifteenCoolDown': {
          // subtract the cost from the users wallet
          shadyEmbeds.setDescription(
            'Buying an elixir for 15 cool downs... Or you might lose your hair..',
          );
          elixirPrice = this.uptoFifteenCoolDown;
          numberOfCoolDowns = randomInt(10, 15);
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
      );

      if (thisStatus.claimStatus.txId) {
        shadyEmbeds.addFields(ObjectUtil.singleFieldBuilder('Elixir', 'Purchased!'));
        shadyEmbeds.addFields(ObjectUtil.singleFieldBuilder('Txn ID', thisStatus.claimStatus.txId));
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
  }

  async shadyShopEmbed(discordUserId: DiscordId): Promise<
    | { content: string; shadyEmbeds?: undefined; shadyComponents?: undefined }
    | {
        shadyEmbeds: EmbedBuilder;
        shadyComponents: ActionRowBuilder<ButtonBuilder>;
        content?: undefined;
      }
  > {
    const userClaimedKarmaWallet = await this.rewardsService.getRewardsTokenWalletWithMostTokens(
      discordUserId,
      this.gameAssets.karmaAsset!._id,
    );
    if (!userClaimedKarmaWallet) {
      throw new Error('User has no claimed karma wallet');
    }

    if (userClaimedKarmaWallet.convertedTokens < this.uptoFiveCoolDown) {
      if (userClaimedKarmaWallet.temporaryTokens > this.uptoFiveCoolDown) {
        return {
          content: `You don't have enough ${this.gameAssets.karmaAsset
            ?.name}!!!\n\nYou have unclaimed ${this.gameAssets.karmaAsset
            ?.name}!\n\nClaim it with ${inlineCode('/claim')}\n\nThen try again.`,
        };
      }
      return {
        content: `You don't have enough ${this.gameAssets.karmaAsset?.name}.\n\nCome back when you have at least ${this.uptoFiveCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
      };
    }
    // Build the embed
    const tenorUrl = await this.tenorManager.fetchRandomTenorGif('trust me, shady, scary');

    const coolDownOfferEmbed = new EmbedBuilder()
      .setTitle('A Shady Offer')
      .setDescription(
        `Have I got a deal for you! I just figured out a new recipe for a for an elixir that works every time!\n\n
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
      value: `For only ${this.uptoFiveCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
      inline: true,
    };
    const uptoTenCoolDownField = {
      name: '10 __guaranteed__ Daruma cooldowns removed! (no refunds)',
      value: `For only ${this.uptoTenCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
      inline: true,
    };
    const uptoFifteenCoolDownField = {
      name: '15 Daruma cooldowns removed! (no refunds no questions asked no telling anyone)',
      value: `For only ${this.uptoFifteenCoolDown} ${this.gameAssets.karmaAsset?.name}!`,
      inline: true,
    };
    if (userClaimedKarmaWallet.convertedTokens >= this.uptoFiveCoolDown) {
      coolDownOfferEmbed.addFields(uptoFiveCoolDownField);
    }
    if (userClaimedKarmaWallet.convertedTokens >= this.uptoTenCoolDown) {
      coolDownOfferEmbed.addFields(uptoTenCoolDownField);
    }
    if (userClaimedKarmaWallet.convertedTokens >= this.uptoFifteenCoolDown) {
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
  async claimElixir(
    _interaction: ButtonInteraction,
    elixirCost: number,
    coolDowns: number,
    caller: GuildMember,
  ): Promise<{
    claimStatus: ClaimTokenResponse;
    resetAssets: AlgoNFTAsset[];
  }> {
    const claimUserId = caller.id as DiscordId;
    // Get the users RX wallet
    const walletToSendFrom =
      await this.rewardsService.getRewardsTokenWalletWithMostTokens<SenderWalletAddress>(
        claimUserId,
        this.gameAssets.karmaAsset!._id,
      );
    if (!walletToSendFrom) {
      throw new Error('User has no claimed karma wallet');
    }
    const claimStatus = await this.algorand.purchaseItem({
      assetIndex: this.gameAssets.karmaAsset!._id,
      amount: elixirCost,
      senderAddress: walletToSendFrom.walletAddress,
    });

    let resetAssets: AlgoNFTAsset[] = [];
    if (claimStatus.txId) {
      logger.info(
        `Elixir Purchased ${claimStatus.status?.txn.txn.aamt ?? ''} ${this.gameAssets.karmaAsset
          ?.name} for ${caller.user.username} (${caller.id})`,
      );
      resetAssets = await this.algoNftService.randomAssetCoolDownReset(claimUserId, coolDowns);
      karmaElixirWebHook(claimStatus, caller);
    }
    return { claimStatus, resetAssets };
  }
  async getOptedInWallets(
    interaction: CommandInteraction,
    asset: AlgoStdAsset,
  ): Promise<Reward[] | null> {
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    const optedInWallets = await this.rewardsService.getAllRewardsTokensForUserByAsset(
      caller.id as DiscordId,
      asset._id,
    );
    if (optedInWallets.length > 0) {
      return optedInWallets;
    }
    const optInButton = this.walletButtonCreator();
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: `You do not have a wallet validated that can receive ${
        asset.name
      }\nCheck your wallets with the command ${inlineCode(
        '/wallet',
      )} and ensure you have OPTED into the ${asset.name} token.`,
      components: [optInButton],
    });
    return null;
  }
  walletButtonCreator(): ActionRowBuilder<ButtonBuilder> {
    const walletButton = new ButtonBuilder()
      .setCustomId('walletSetup')
      .setLabel('Setup Wallet')
      .setStyle(ButtonStyle.Primary);
    return new ActionRowBuilder<ButtonBuilder>().setComponents(walletButton);
  }
  // Scheduled the first day of the month at 1am
  @Schedule('0 1 1 * *')
  @Guard(GameAssetsNeeded)
  async monthlyClaim(): Promise<void> {
    logger.info('Monthly Claim Started');
    const walletsWithUnclaimedAssets = await this.rewardsService.fetchWalletsWithUnclaimedAssets(
      50,
      this.gameAssets.karmaAsset!,
    );
    await this.algorand.unclaimedAutomated(walletsWithUnclaimedAssets, this.gameAssets.karmaAsset!);
    logger.info('Monthly Claim Finished');
  }
  // Scheduled at 2am every day
  @Schedule('0 2 * * *')
  @Guard(GameAssetsNeeded)
  async dailyClaim(): Promise<void> {
    logger.info('Daily Claim Started');
    const walletsWithUnclaimedAssets = await this.rewardsService.fetchWalletsWithUnclaimedAssets(
      20,
      this.gameAssets.karmaAsset!,
    );

    await this.algorand.unclaimedAutomated(walletsWithUnclaimedAssets, this.gameAssets.karmaAsset!);
    logger.info('Daily Claim Finished');
  }
  // Scheduled at 3am every day
  @Schedule('0 3 * * *')
  @Guard(GameAssetsNeeded)
  async checkGameAssetAmounts(): Promise<void> {
    const assetWallet = this.algorand.getMnemonicAccounts();
    const karmaAsset = await this.algorand.getTokenOptInStatus(
      assetWallet.token.addr as WalletAddress,
      this.gameAssets.karmaAsset!._id,
    );
    const enlightenmentAsset = await this.algorand.getTokenOptInStatus(
      assetWallet.token.addr as WalletAddress,
      this.gameAssets.enlightenmentAsset!._id,
    );
    const lowKarmaAmount = 200_000;
    const lowEnlightenmentAmount = 100;
    if (karmaAsset.tokens < lowKarmaAmount) {
      await this.sendTokenLowMessageToDevelopers('KRMA', lowKarmaAmount, karmaAsset.tokens);
      await this.attemptKarmaReplenish();
    }
    if (enlightenmentAsset.tokens < lowEnlightenmentAmount) {
      await this.sendTokenLowMessageToDevelopers(
        'ENLT',
        lowEnlightenmentAmount,
        enlightenmentAsset.tokens,
      );
    }
  }
  @Guard(PermissionGuard(['Administrator']), GameAssetsNeeded)
  @Slash({
    description: 'Force a KRMA Replenish (Admin Only)',
    name: 'replenish_bot_karma',
  })
  @Category('Admin')
  @SlashGroup('admin')
  async replenishKarma(
    @SlashOption({
      description: 'Are You Sure?',
      name: 'first_confirm',
      required: true,
      type: ApplicationCommandOptionType.Boolean,
    })
    confirm1: boolean,
    @SlashOption({
      description: 'Are You Really Sure?',
      name: 'second_confirm',
      required: true,
      type: ApplicationCommandOptionType.Boolean,
    })
    confirm2: boolean,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    if (!confirm1 || !confirm2) {
      await InteractionUtils.replyOrFollowUp(interaction, {
        content: 'You must confirm both options to replenish karma.',
      });
      return;
    }
    if (!this.replenishTokenAccount) {
      await InteractionUtils.replyOrFollowUp(interaction, {
        content: 'Replenish Token Account Not Found',
      });
      return;
    }
    await this.attemptKarmaReplenish();
  }
  async attemptKarmaReplenish(): Promise<void> {
    if (!this.replenishTokenAccount) {
      logger.error('Replenish Token Account Not Found');
      return;
    }
    const replenishAmount = 100_000;
    const assetWallet = this.algorand.getMnemonicAccounts();
    await sendMessageToAdminChannel(
      `Attempting to Replenish ${this.gameAssets.karmaAsset?.name} Tokens From -- Account: ${
        this.replenishTokenAccount
      } -- Amount: ${replenishAmount.toLocaleString()}`,
      this.client,
    );
    const replenishTxn = await this.algorand.tipToken({
      assetIndex: this.gameAssets.karmaAsset!._id,
      amount: replenishAmount,
      receiverAddress: assetWallet.token.addr as ReceiverWalletAddress,
      senderAddress: this.replenishTokenAccount,
    });
    await (replenishTxn.txId
      ? sendMessageToAdminChannel(
          `Replenished ${this.gameAssets.karmaAsset?.name} Tokens -- Txn ID: ${
            replenishTxn.txId
          } -- Amount: ${replenishTxn.status?.txn.txn.aamt?.toLocaleString()}`,
          this.client,
        )
      : sendMessageToAdminChannel(
          `Failed to Replenish ${this.gameAssets.karmaAsset?.name} Tokens`,
          this.client,
        ));
  }
  async sendTokenLowMessageToDevelopers(
    assetName: string,
    lowAmount: number,
    balance: number | bigint,
  ): Promise<void> {
    const developerMessage = `${getDeveloperMentions()} -- ${assetName} is below ${lowAmount.toLocaleString()} tokens. Please refill. Current Balance: ${balance.toLocaleString()}`;
    logger.error(developerMessage);
    await sendMessageToAdminChannel(developerMessage, this.client);
  }
}
