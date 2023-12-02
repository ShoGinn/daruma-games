import { GuildMember, Message, TextBasedChannel, TextChannel } from 'discord.js';

import { Client } from 'discordx';

import { getConfig } from '../../config/config.js';
import { DiscordId } from '../../types/core.js';
import { getDeveloperMentions } from '../functions/owner-utils.js';

export class ChannelUtils {
  public static async getGuildMemberByDiscordId(
    discordUserId: DiscordId,
    client: Client,
  ): Promise<GuildMember | undefined> {
    const guilds = client.guilds.cache;
    for (const guild of guilds.values()) {
      try {
        const member = await guild.members.fetch(discordUserId);
        if (member) {
          return member;
        }
      } catch {
        continue;
      }
    }
    return;
  }
  public static async sendMessageToAdminChannel(message: string, client: Client): Promise<boolean> {
    // Find the admin channel by iterating through all the guilds
    const adminChannel = getConfig().get('adminChannelId');
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

  public static async getLatestEmbedMessageInChannelByTitle(
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
  public static async getAllEmbedMessagesInChannelByTitle(
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
  public static async deleteMessage(message: Message | undefined): Promise<void> {
    if (message) {
      await message.delete().catch(() => null);
    }
  }
  public static async sendTokenLowMessageToDevelopers(
    client: Client,
    assetName: string,
    lowAmount: number,
    balance: number | bigint,
  ): Promise<void> {
    const developerMessage = `${getDeveloperMentions()} -- ${assetName} is below ${lowAmount.toLocaleString()} tokens. Please refill. Current Balance: ${balance.toLocaleString()}`;
    await ChannelUtils.sendMessageToAdminChannel(developerMessage, client);
  }
}
