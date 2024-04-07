import {
  ButtonInteraction,
  CommandInteraction,
  EmbedBuilder,
  GuildChannel,
  GuildMember,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from 'discord.js';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class InteractionUtils {
  public static async replyOrFollowUp(
    interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
    replyOptions: (InteractionReplyOptions & { ephemeral?: boolean }) | string,
  ): Promise<InteractionResponse | Message> {
    if (interaction.replied) {
      // if interaction is already replied
      return await interaction.followUp(replyOptions);
    } else if (interaction.deferred) {
      // if interaction is deferred but not replied
      return await interaction.editReply(replyOptions);
    } else {
      // if interaction is not handled yet
      return await interaction.reply(replyOptions);
    }
  }
  public static async getInteractionCaller(
    interaction: CommandInteraction | MessageComponentInteraction,
  ): Promise<GuildMember> {
    const { member } = interaction;
    if (member == undefined) {
      await InteractionUtils.replyOrFollowUp(interaction, 'Unable to extract member');
      throw new Error('Unable to extract member');
    }
    if (member instanceof GuildMember) {
      return member;
    }
    throw new Error('Unable to extract member');
  }
  public static simpleSuccessEmbed = async (
    interaction: CommandInteraction,
    message: string,
  ): Promise<Message> => {
    const embed = new EmbedBuilder().setColor('Green').setTitle(`:white_check_mark: ${message}`);

    return (await InteractionUtils.replyOrFollowUp(interaction, {
      embeds: [embed],
      fetchReply: true,
    })) as Message;
  };

  public static simpleErrorEmbed = async (
    interaction: CommandInteraction,
    message: string,
  ): Promise<Message> => {
    const embed = new EmbedBuilder().setColor('Red').setTitle(`:x: ${message}`);

    return (await InteractionUtils.replyOrFollowUp(interaction, {
      embeds: [embed],
      fetchReply: true,
    })) as Message;
  };
  public static getInteractionChannelName = (
    interaction: CommandInteraction | ButtonInteraction,
  ): string => {
    let channelName = 'this channel';
    if (interaction.channel && interaction.channel instanceof GuildChannel) {
      channelName = interaction.channel.name;
    }
    return channelName;
  };
}
