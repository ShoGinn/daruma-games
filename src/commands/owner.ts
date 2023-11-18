import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  CommandInteraction,
  GuildChannel,
  inlineCode,
  MessageContextMenuCommandInteraction,
} from 'discord.js';

import { Category, EnumChoice } from '@discordx/utilities';
import { ContextMenu, Discord, Guard, Slash, SlashChoice, SlashGroup, SlashOption } from 'discordx';

import { inject, injectable } from 'tsyringe';

import { GameTypes } from '../enums/daruma-training.js';
import { BotOwnerOnly } from '../guards/bot-owner-only.js';
import { GameAssetsNeeded } from '../guards/game-assets-needed.js';
import { CommandService } from '../services/command-services.js';
import { InteractionUtils } from '../utils/classes/interaction-utils.js';

@Discord()
@injectable()
@SlashGroup({ description: 'Dev Commands', name: 'dev' })
@Category('Developer')
@Guard(BotOwnerOnly)
export default class DevelopmentCommands {
  constructor(@inject(CommandService) private commandService: CommandService) {}

  /**
   * Join the dojo channel
   *
   * @param {GuildChannel} channel
   * @param {GameTypes} channelType
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @Slash({
    name: 'join',
    description: 'Have the bot join a dojo channel!',
  })
  @SlashGroup('dev')
  async join(
    @SlashOption({
      description: 'Channel to join',
      name: 'channel',
      required: true,
      type: ApplicationCommandOptionType.Channel,
    })
    channel: GuildChannel,
    @SlashChoice(...EnumChoice(GameTypes))
    @SlashOption({
      description: 'Game type',
      name: 'game_type',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    channelType: GameTypes,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await this.commandService.addAndJoinChannel(channel, channelType);

    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Joining ${channel.toString()}, with the default settings!`,
    );
  }
  /**
   * Start the waiting room again
   *
   * @param {MessageContextMenuCommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @ContextMenu({
    name: 'Start Waiting Room',
    type: ApplicationCommandType.Message,
  })
  async startWaitingRoomAgain(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await InteractionUtils.replyOrFollowUp(interaction, 'Starting waiting room again...');
    const { channel } = interaction;
    if (!channel) {
      await InteractionUtils.replyOrFollowUp(interaction, 'Channel not found!');
      return;
    }
    await this.commandService.joinChannel(channel);
  }
  /**
   * Leave the dojo channel
   *
   * @param {MessageContextMenuCommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @ContextMenu({ name: 'Leave Dojo', type: ApplicationCommandType.Message })
  async leave(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const { channel } = interaction;
    const channelString = InteractionUtils.getInteractionChannelName(interaction);
    if (channel) {
      const channelExists = await this.commandService.deleteChannel(channel);
      await this.commandService.deleteWaitingRoomMessage(channel);
      await (channelExists
        ? InteractionUtils.replyOrFollowUp(interaction, `Left ${channelString}!`)
        : InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channelString}!`));
      return;
    }
    await InteractionUtils.replyOrFollowUp(interaction, `I'm not in ${channelString}!`);
  }
  /**
   * Sync all the user assets
   *
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @Slash({
    name: 'sync_all_user_assets',
    description: 'Sync All User Assets',
  })
  @SlashGroup('dev')
  async syncAllUserAssets(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Forcing an Out of Cycle User Asset Sync...`,
    );

    await this.commandService.syncUserAssets();

    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'Completed the Sync',
      ephemeral: true,
    });
  }
  /**
   * Clear all the cool downs for all users
   *
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @Slash({
    name: 'clear_all_cds',
    description: 'Clear every user cooldown!!!!! (Owner Only)',
  })
  @SlashGroup('dev')
  async clearEveryCoolDown(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Clearing all the cool downs for all users...`,
    );
    await this.commandService.clearAssetCoolDownsForAllUsers();

    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'All cool downs cleared',
      ephemeral: true,
    });
  }

  /**
   * Force Claim for all wallets above threshold
   *
   * @param {number} threshold
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @Slash({
    name: 'atomic_claim',
    description: 'Force claim for all wallets above threshold (Owner Only)',
  })
  @SlashGroup('dev')
  @Guard(GameAssetsNeeded)
  async forceAtomicClaim(
    @SlashOption({
      description: 'The threshold to claim for all users above',
      name: 'threshold',
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    threshold: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    await InteractionUtils.replyOrFollowUp(
      interaction,
      `Attempting to claim all unclaimed assets for all users above ${threshold}..`,
    );
    await this.commandService.forceClaimOfRewardsForAllUsers(threshold);
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: 'Completed',
      ephemeral: true,
    });
  }
  /**
   * Set the Karma Modifier
   *
   * @param {string} start_date
   * @param {string} stop_date
   * @param {number} modifier
   * @param {CommandInteraction} interaction
   * @returns {*}  {Promise<void>}
   * @memberof DevelopmentCommands
   */
  @Slash({
    name: 'set_karma_modifier',
    description: 'Modifier',
  })
  @SlashGroup('dev')
  @Guard(GameAssetsNeeded)
  async karmaModifier(
    @SlashOption({
      description: 'The Date to Start the Modifier',
      name: 'start_date',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashOption({
      description: 'The Date to Stop the Modifier',
      name: 'stop_date',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    @SlashOption({
      description: 'The Number Modifier',
      name: 'modifier',
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    start_date: string,
    stop_date: string,
    modifier: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    let message = `Setting the modifier from ${inlineCode(start_date)} to ${inlineCode(
      stop_date,
    )} to ${inlineCode(modifier.toString())}...`;

    try {
      await this.commandService.setKarmaModifier(start_date, stop_date, modifier);
    } catch (error) {
      message = 'Error setting the modifier';
      if (error instanceof Error) {
        message = error.message;
      }
    }
    await InteractionUtils.replyOrFollowUp(interaction, {
      content: message,
      ephemeral: true,
    });
  }
}
