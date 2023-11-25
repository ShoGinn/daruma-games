/* eslint-disable @typescript-eslint/unbound-method */
import { Guild, GuildBasedChannel, Message, TextChannel, User } from 'discord.js';

import { Client } from 'discordx';

import { container } from 'tsyringe';

import { Mock } from '../../../tests/mocks/mock-discord.js';
import { getConfig } from '../../config/config.js';
import { DiscordId } from '../../types/core.js';

import { ChannelUtils } from './channel-utils.js';

const config = getConfig();
describe('Channel Utils', () => {
  const configCopy = config.getProperties();
  let client: Client;
  let mock: Mock;
  let guild: Guild;
  let adminChannel: GuildBasedChannel;
  let user: User;
  beforeEach(() => {
    config.load(configCopy);
    mock = container.resolve(Mock);
    client = mock.getClient() as Client;
    guild = mock.getGuild();
    adminChannel = guild.channels.cache.first()!;
    user = mock.getUser();
  });
  afterEach(() => {
    container.reset();
    container.clearInstances();
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
  describe('Admin Chanel Utils', () => {
    beforeEach(() => {
      config.set('adminChannelId', adminChannel?.id || '');
    });

    describe('sendMessageToAdminChannel', () => {
      test('should send a message to the admin channel', async () => {
        const message = 'test message';
        const sent = await ChannelUtils.sendMessageToAdminChannel(message, client);
        expect(sent).toBeTruthy();
      });
      test('should return false if the admin channel does not exist', async () => {
        config.set('adminChannelId', '123456789');
        const message = 'test message';
        const sent = await ChannelUtils.sendMessageToAdminChannel(message, client);
        expect(sent).toBeFalsy();
      });
      test('should return false if there are no guilds', async () => {
        client.guilds.cache.clear();
        const message = 'test message';
        const sent = await ChannelUtils.sendMessageToAdminChannel(message, client);
        expect(sent).toBeFalsy();
      });
    });
  });
  describe('getGuildMemberByDiscordId', () => {
    test('should return the guild member', async () => {
      const member = await ChannelUtils.getGuildMemberByDiscordId(user?.id as DiscordId, client);
      expect(member).toBeTruthy();
    });
    test('should return undefined if the member does not exist', async () => {
      const member = await ChannelUtils.getGuildMemberByDiscordId('12345' as DiscordId, client);
      expect(member).toBeUndefined();
    });
    test('should return undefined if there are no guilds', async () => {
      client.guilds.cache.clear();
      const member = await ChannelUtils.getGuildMemberByDiscordId(user?.id as DiscordId, client);
      expect(member).toBeUndefined();
    });
  });

  describe('getLatestEmbedMessageInChannelByTitle', () => {
    let channel: TextChannel;
    const message1 = {
      embeds: [{ title: 'Hello World' }],
      createdTimestamp: new Date(2021, 1, 1),
    } as unknown as Message<true>;
    const message2 = {
      embeds: [{ title: 'Goodbye World' }],
      createdTimestamp: new Date(2021, 1, 2),
    } as unknown as Message<true>;

    beforeEach(() => {
      // Arrange
      channel = {
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map()),
        },
      } as unknown as TextChannel;
    });

    // Happy path tests
    test('should return the latest message with matching embed title', async () => {
      // Arrange
      const messages = new Map();
      messages.set('1', message1);
      messages.set('2', message2);
      channel.messages.fetch = jest.fn().mockResolvedValue(messages);

      // Act
      const result = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(
        channel,
        'Hello World',
      );

      // Assert
      expect(result).toBe(message1);
    });
    test('should return the latest message with matching embed title, even if it is not the first message', async () => {
      // Arrange
      const messages = new Map();
      messages.set('1', message1);
      messages.set('2', message2);
      channel.messages.fetch = jest.fn().mockResolvedValue(messages);

      // Act
      const result = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(channel, 'World');

      // Assert
      expect(result).toBe(message2);
    });
    test('should return undefined if no message has matching embed title', async () => {
      // Arrange
      const messages = new Map();
      messages.set('1', message1);
      messages.set('2', message2);
      channel.messages.fetch = jest.fn().mockResolvedValue(messages);

      // Act
      const result = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(channel, 'Foo Bar');

      // Assert
      expect(result).toBeUndefined();
    });

    // Edge cases
    test('should return undefined if channel has no messages', async () => {
      // Act
      const result = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(
        channel,
        'Hello World',
      );

      // Assert
      expect(result).toBeUndefined();
    });

    test('should return undefined if latest message has no embeds', async () => {
      // Arrange
      const message = {} as unknown as Message<true>;

      const messages = new Map();
      messages.set('1', message);

      channel.messages.fetch = jest.fn().mockResolvedValue(messages);

      // Act
      const result = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(
        channel,
        'Hello World',
      );

      // Assert
      expect(result).toBeUndefined();
    });

    // Error cases
    test('should return undefined if channel is undefined', async () => {
      // Act
      const result = await ChannelUtils.getLatestEmbedMessageInChannelByTitle(
        undefined,
        'Hello World',
      );

      // Assert
      expect(result).toBeUndefined();
    });
  });
  describe('getAllEmbedMessagesInChannelByTitle', () => {
    test('should return an array of messages with matching embed title', async () => {
      // Arrange
      const channel = {
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map()),
        },
      } as unknown as TextChannel;
      const message1 = {
        embeds: [{ title: 'Hello World' }],
        createdTimestamp: new Date(2021, 1, 1),
      } as unknown as Message<true>;
      const message2 = {
        embeds: [{ title: 'Goodbye World' }],
        createdTimestamp: new Date(2021, 1, 2),
      } as unknown as Message<true>;
      const message3 = {
        embeds: [{ title: 'Hello World' }],
        createdTimestamp: new Date(2021, 1, 3),
      } as unknown as Message<true>;
      const messages = new Map();
      messages.set('1', message1);
      messages.set('2', message2);
      messages.set('3', message3);
      channel.messages.fetch = jest.fn().mockResolvedValue(messages);

      // Act
      const result = await ChannelUtils.getAllEmbedMessagesInChannelByTitle(channel, 'Hello World');

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toContain(message1);
      expect(result).toContain(message3);
    });
    test('should return undefined if channel is undefined', async () => {
      // Act
      const result = await ChannelUtils.getAllEmbedMessagesInChannelByTitle(
        undefined,
        'Hello World',
      );

      // Assert
      expect(result).toBeUndefined();
    });
    test('should return undefined if channel has no messages', async () => {
      // Arrange
      const channel = {
        messages: {
          fetch: jest.fn().mockRejectedValueOnce(null),
        },
      } as unknown as TextChannel;

      // Act
      const result = await ChannelUtils.getAllEmbedMessagesInChannelByTitle(channel, 'Hello World');

      // Assert
      expect(result).toBeUndefined();
    });
  });
  describe('deleteMessage', () => {
    test('should delete the message', async () => {
      // Arrange
      const message = { delete: jest.fn().mockResolvedValue('') } as unknown as Message;
      // Act
      await ChannelUtils.deleteMessage(message);
      // Assert
      expect(message.delete).toHaveBeenCalledTimes(1);
    });
    test('should not delete the message if an error occurs', async () => {
      // Arrange
      const message = { delete: jest.fn(() => Promise.reject()) } as unknown as Message;
      // Act
      await ChannelUtils.deleteMessage(message);
      // Assert
      expect(message.delete).toHaveBeenCalledTimes(1);
    });
  });
});
