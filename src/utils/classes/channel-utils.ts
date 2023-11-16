import { Message, TextBasedChannel, TextChannel } from 'discord.js';

import { Client } from 'discordx';

import { getConfig } from '../../config/config.js';

export class ChannelUtils {
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
}
