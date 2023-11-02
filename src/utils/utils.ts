import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
  APIEmbedField,
  CommandInteraction,
  EmbedBuilder,
  Guild,
  GuildMember,
  InteractionReplyOptions,
  InteractionResponse,
  Message,
  MessageComponentInteraction,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  TextBasedChannel,
  TextChannel,
  userMention,
} from 'discord.js';
import { Client } from 'discordx';
import { Random } from 'random-js';

import logger from './functions/logger-factory.js';
import { getConfig } from '../config/config.js';
import { ConstantRange } from '../core/constants.js';
const botConfig = getConfig();
export class ObjectUtil {
  static {
    dayjs.extend(relativeTime);
    dayjs.extend(duration);
  }
  public static ellipseAddress(
    address: string | null = '',
    start: number = 5,
    end: number = 5,
  ): string {
    if (!address) {
      return '';
    }
    if (address.length <= start + end) {
      return address;
    }
    start = Math.min(start, address.length);
    end = Math.min(end, address.length - start);
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }

  public static singleFieldBuilder(
    name: string,
    value: string,
    inline: boolean = false,
  ): [APIEmbedField] {
    return [
      {
        name,
        value,
        inline,
      },
    ];
  }
  public static onlyDigits(string: string): string {
    return string.replaceAll(/\D/g, '');
  }

  public static delayFor(this: void, ms: number): Promise<void> {
    return new Promise((result) => setTimeout(result, ms));
  }
  public static randomDelayFor = async (
    minDelay: number,
    maxDelay: number,
    delayFunction: (ms: number) => Promise<void> = ObjectUtil.delayFor,
  ): Promise<void> => {
    const delay = RandomUtils.random.integer(Math.min(minDelay, maxDelay), maxDelay);
    await delayFunction(delay);
  };

  /**
   * Converts a bigint or number to a number with the specified number of decimal places.
   *
   * @param {bigint|number} integer - The number to convert. If a `bigint` is passed, it will be divided by 10^`decimals`.
   * @param {number} decimals - The number of decimal places for the result. If `decimals` is 0, the integer will not be divided.
   * @returns {number} - The converted number.
   */

  public static convertBigIntToNumber(integer: bigint | number, decimals: number): number {
    if (typeof integer === 'number') {
      return integer;
    }
    if (typeof integer === 'bigint') {
      if (decimals === 0 || integer === BigInt(0)) {
        return Number.parseInt(integer.toString());
      }
      const singleUnit = BigInt(`1${'0'.repeat(decimals)}`);
      const wholeUnits = integer / singleUnit;

      return Number.parseInt(wholeUnits.toString());
    }
    throw new Error('Invalid type passed to convertBigIntToNumber');
  }

  public static timeAgo(date: dayjs.ConfigType): string {
    return dayjs(date).fromNow();
  }
  public static moreThanTwentyFourHoursAgo(date: dayjs.ConfigType): boolean {
    return dayjs().diff(dayjs(date), 'hour') >= 24;
  }
  public static timeFromNow(durationInMilliseconds: dayjs.ConfigType): string {
    return dayjs(durationInMilliseconds).fromNow();
  }
  public static timeToHuman(durationInMilliseconds: number): string {
    return dayjs.duration(durationInMilliseconds).humanize();
  }
}

export class InteractionUtils {
  public static getMessageFromContextInteraction(
    interaction: MessageContextMenuCommandInteraction,
  ): Promise<Message<boolean>> | undefined {
    const messageId = interaction.targetId;
    return interaction.channel?.messages.fetch(messageId);
  }

  public static async replyOrFollowUp(
    interaction: CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
    replyOptions: (InteractionReplyOptions & { ephemeral?: boolean }) | string,
  ): Promise<InteractionResponse<boolean> | Message<boolean>> {
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
  ): Promise<Message<boolean>> => {
    const embed = new EmbedBuilder().setColor('Green').setTitle(`:white_check_mark: ${message}`);

    return (await InteractionUtils.replyOrFollowUp(interaction, {
      embeds: [embed],
      fetchReply: true,
    })) as Message<boolean>;
  };

  public static simpleErrorEmbed = async (
    interaction: CommandInteraction,
    message: string,
  ): Promise<Message<boolean>> => {
    const embed = new EmbedBuilder().setColor('Red').setTitle(`:x: ${message}`);

    return (await InteractionUtils.replyOrFollowUp(interaction, {
      embeds: [embed],
      fetchReply: true,
    })) as Message<boolean>;
  };
}

/**
 * Get the list of devs
 *
 * @returns {*}  {Array<string>}
 */
export function getDevelopers(): string[] {
  const botOwnerId = botConfig.get('botOwnerID');
  return [...new Set([botOwnerId])];
}

export function getDeveloperMentions(): string {
  const botOwnerIds = getDevelopers();
  // join the ids with a discord mention format
  return botOwnerIds.map((id) => userMention(id)).join(' ');
}
/**
 * Check if the user is a dev
 *
 * @param {string} id
 * @returns {*}  {boolean}
 */
export function isDeveloper(id: string): boolean {
  return getDevelopers().includes(id);
}

export async function fetchGuild(guildId: string, client: Client): Promise<Guild | null> {
  try {
    return await client.guilds.fetch(guildId);
  } catch (error) {
    logger.error(`Error fetching guild ${guildId}: ${JSON.stringify(error)}`);
    return null;
  }
}
export function getAdminChannel(): string {
  return botConfig.get('adminChannelId');
}
export async function sendMessageToAdminChannel(message: string, client: Client): Promise<boolean> {
  // Find the admin channel by iterating through all the guilds
  const adminChannel = getAdminChannel();
  const guilds = client.guilds.cache;
  for (const guild of guilds.values()) {
    const channel = guild.channels.cache.get(adminChannel);
    if (channel) {
      await (channel as TextChannel).send(message);
      return true;
    }
    return false;
  }
  return false;
}

export async function getLatestEmbedMessageInChannelByTitle(
  channel: TextChannel | TextBasedChannel | undefined,
  title: string,
): Promise<Message<boolean> | undefined> {
  if (!channel) {
    return undefined;
  }
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = [...messages.values()].sort(
      (a, b) => b.createdTimestamp - a.createdTimestamp,
    );

    for (const message of sortedMessages) {
      for (const embed of message.embeds) {
        if (embed.title && embed.title.includes(title)) {
          return message;
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
export async function getAllEmbedMessagesInChannelByTitle(
  channel: TextChannel | TextBasedChannel | undefined,
  title: string,
): Promise<Array<Message<boolean>> | undefined> {
  if (!channel) {
    return undefined;
  }
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    return [...messages.values()].filter((message) => {
      for (const embed of message.embeds) {
        if (embed.title && embed.title.includes(title)) {
          return true;
        }
      }
      return false;
    });
  } catch {
    return undefined;
  }
}
export async function deleteMessage(message: Message | undefined): Promise<void> {
  if (message) {
    await message.delete().catch(() => null);
  }
}
/**
 * Functions concerning pseudo-randomness
 */
export class RandomUtils {
  /**
   * Redefining the random js library
   */
  public static random: Random = new Random();

  /**
   * Generates a random number between min included and max excluded
   * @param {number} min - minimum value included
   * @param {number} max - maximum value excluded
   * @returns {number} a random number between min included and max excluded
   */
  public static randInt = (min: number, max: number): number =>
    RandomUtils.random.integer(min, max - 1);

  /**
   * Generates a random number in the range (both interval bounds included)
   * @param {ConstantRange} range - typically something in constants as {MIN: number, MAX: number}
   * @param {number} minAdd - Amount to add to range.MIN ; Default : 1
   * @param {number} maxAdd - Amount to add to range.MAX ; Default : 1
   * @returns {number} a random number in [MIN, MAX]
   */
  public static rangedInt = (
    range: ConstantRange,
    minAdd: number = 0,
    maxAdd: number = 1,
  ): number => RandomUtils.random.integer(range.MIN + minAdd, range.MAX + maxAdd);

  /**
   * Generates a random number between -variation and variation
   * @param {number} variation
   * @returns {number} a random number in [-variation, variation]
   */
  public static variationInt = (variation: number): number =>
    RandomUtils.random.integer(-variation, variation);
}
