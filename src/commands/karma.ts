import {
  ApplicationCommandOptionType,
  ButtonInteraction,
  CommandInteraction,
  GuildMember,
} from 'discord.js';

import { Category, PermissionGuard, RateLimit, TIME_UNIT } from '@discordx/utilities';
import { ButtonComponent, Client, Discord, Guard, Slash, SlashGroup, SlashOption } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { GameAssetsNeeded } from '../guards/game-assets-needed.js';
import { GameAssets } from '../services/game-assets.js';
import { DiscordId } from '../types/core.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';
import logger from '../utils/functions/logger-factory.js';

import { KarmaCommandService } from './karma.service.js';
import { KarmaShopCommandService } from './karma.shop.service.js';
import { KarmaVendorCommandService } from './karma.vendor.service.js';

@Discord()
@injectable()
@Category('Karma')
@SlashGroup({ description: 'KARMA Commands', name: 'karma' })
@SlashGroup({ description: 'Admin Commands', name: 'admin' })
export default class KarmaCommand {
  constructor(
    @inject(GameAssets) private gameAssets: GameAssets,
    @inject(KarmaCommandService) private karmaService: KarmaCommandService,
    @inject(KarmaShopCommandService) private karmaShopService: KarmaShopCommandService,
    @inject(KarmaVendorCommandService) private karmaVendorService: KarmaVendorCommandService,
    private client: Client,
  ) {}

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
      type: ApplicationCommandOptionType.Integer,
    })
    amount: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embed = await this.karmaService.addKarma(karmaAddUser.id as DiscordId, amount);
    // Provide an audit log of who added karma and to who
    const caller = await InteractionUtils.getInteractionCaller(interaction);
    logger.warn(
      `${caller.user.username} added ${amount} ${this.gameAssets.karmaAsset?.name} to ${karmaAddUser.user.username}`,
    );
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }
  /**
   * This is the command to SEND Karma to a user
   *
   * @param {GuildMember} receiver
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
    receiver: GuildMember,
    @SlashOption({
      description: 'How Much are you Sending? (Bot uses the wallet with the most KARMA)',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Integer,
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

    // get the caller's wallet
    const embed = await this.karmaService.dispenseAssetToUser(
      this.client,
      interaction,
      receiver,
      sendingWhy,
      karmaAmount,
    );
    await InteractionUtils.replyOrFollowUp(interaction, embed);
  }

  /**
   * This is the TIP command
   *
   * @param {GuildMember} tipReceiver
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
  @Guard(RateLimit(TIME_UNIT.minutes, 1, { ephemeral: true }), GameAssetsNeeded)
  async tip(
    @SlashOption({
      description: 'Who To Tip?',
      name: 'username',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    tipReceiver: GuildMember,
    @SlashOption({
      description: 'How Much are you Tipping? (Bot uses the wallet with the most KARMA)',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    karmaAmount: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const tipSender = await InteractionUtils.getInteractionCaller(interaction);

    const embed = await this.karmaService.tipAsset(
      interaction,
      tipReceiver,
      tipSender,
      karmaAmount,
    );
    await InteractionUtils.replyOrFollowUp(interaction, embed);
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
  @Guard(RateLimit(TIME_UNIT.minutes, 2, { ephemeral: true }), GameAssetsNeeded)
  async karmaClaim(interaction: CommandInteraction): Promise<void> {
    await this.claim(interaction);
  }

  @Slash({
    name: 'claim',
    description: 'Claim your KARMA',
  })
  @SlashGroup('karma')
  @Guard(RateLimit(TIME_UNIT.minutes, 2, { ephemeral: true }), GameAssetsNeeded)
  async claim(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    const embed = await this.karmaService.claimAsset(interaction);
    if (embed) {
      await InteractionUtils.replyOrFollowUp(interaction, embed);
    }
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
    await interaction.deferReply({ ephemeral: true });

    const embed = await this.karmaShopService.karmaShop(interaction);
    if (embed) {
      await InteractionUtils.replyOrFollowUp(interaction, embed);
    }
  }

  @ButtonComponent({ id: 'randomCoolDownOffer' })
  @Guard(GameAssetsNeeded)
  async shadyShop(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    // Get the shop embed
    const embed = await this.karmaVendorService.shadyShop(interaction, this.gameAssets.karmaAsset);
    if (embed) {
      await InteractionUtils.replyOrFollowUp(interaction, embed);
    }
  }
}
