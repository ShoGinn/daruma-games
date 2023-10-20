import { Guild, GuildBasedChannel, Message, TextChannel } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { getConfig } from '../../../src/config/config.js';
import {
  fetchGuild,
  getAdminChannel,
  getAllEmbedMessagesInChannelByTitle,
  getDeveloperMentions,
  getDevelopers,
  getLatestEmbedMessageInChannelByTitle,
  isDeveloper,
  sendMessageToAdminChannel,
} from '../../../src/utils/utils.js';
import { Mock } from '../../mocks/mock-discord.js';
const config = getConfig();
describe('Discord Utils', () => {
  const configCopy = config.getProperties();
  let client: Client;
  let mock: Mock;
  let guild: Guild;
  let adminChannel: GuildBasedChannel;
  beforeAll(() => {
    mock = container.resolve(Mock);
    client = mock.getClient() as Client;
    guild = mock.getGuild();
    adminChannel = guild.channels.cache.first();
  });
  beforeEach(() => {
    config.load(configCopy);
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Developer/Owner Utils', () => {
    beforeEach(() => {
      config.set('botOwnerID', 'BOT_OWNER_ID');
    });
    describe('getDevelopers', () => {
      test('should return an array of developers', () => {
        const devs = getDevelopers();
        expect(devs).toHaveLength(1);
        expect(devs).toContain('BOT_OWNER_ID');
        config.set('botOwnerID', '123');
        expect(getDevelopers()).toHaveLength(1);
      });
    });
    describe('getDeveloperMentions', () => {
      test('should return a string of mentions', () => {
        const mentions = getDeveloperMentions();
        expect(mentions).toBe('<@BOT_OWNER_ID>');
        config.set('botOwnerID', '123');
        expect(getDeveloperMentions()).toBe('<@123>');
      });
    });
  });
  describe('isDev', () => {
    test('should return true if the user is a developer', () => {
      config.set('botOwnerID', '123');
      expect(isDeveloper('123')).toBe(true);
    });
    test('should return false if the user is not a developer', () => {
      config.set('botOwnerID', '123');
      expect(isDeveloper('456')).toBe(false);
    });
  });
  describe('fetchGuild', () => {
    test('should return a guild', async () => {
      const fetchedGuild = await fetchGuild(guild.id, client);
      expect(fetchedGuild?.id).toBe(guild.id);
    });
    test('should return undefined if the guild does not exist', async () => {
      client.guilds.fetch = jest.fn().mockRejectedValueOnce(null);
      const fetchedGuild = await fetchGuild('123456789', client);
      expect(fetchedGuild).toBeNull();
    });
  });
  describe('Admin Chanel Utils', () => {
    beforeEach(() => {
      config.set('adminChannelId', adminChannel?.id || '');
    });

    describe('getAdminChannel', () => {
      test('should return the admin channel', () => {
        const thisAdminChannel = getAdminChannel();
        expect(thisAdminChannel).toBe(adminChannel?.id);
      });
    });
    describe('sendMessageToAdminChannel', () => {
      test('should send a message to the admin channel', async () => {
        const message = 'test message';
        const sent = await sendMessageToAdminChannel(message, client);
        expect(sent).toBeTruthy();
      });
      test('should return false if the admin channel does not exist', async () => {
        config.set('adminChannelId', '123456789');
        const message = 'test message';
        const sent = await sendMessageToAdminChannel(message, client);
        expect(sent).toBeFalsy();
      });
      test('should return false if there are no guilds', async () => {
        client.guilds.cache.clear();
        const message = 'test message';
        const sent = await sendMessageToAdminChannel(message, client);
        expect(sent).toBeFalsy();
      });
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
      const result = await getLatestEmbedMessageInChannelByTitle(channel, 'Hello World');

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
      const result = await getLatestEmbedMessageInChannelByTitle(channel, 'World');

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
      const result = await getLatestEmbedMessageInChannelByTitle(channel, 'Foo Bar');

      // Assert
      expect(result).toBeUndefined();
    });

    // Edge cases
    test('should return undefined if channel has no messages', async () => {
      // Act
      const result = await getLatestEmbedMessageInChannelByTitle(channel, 'Hello World');

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
      const result = await getLatestEmbedMessageInChannelByTitle(channel, 'Hello World');

      // Assert
      expect(result).toBeUndefined();
    });

    // Error cases
    test('should return undefined if channel is undefined', async () => {
      // Act
      const result = await getLatestEmbedMessageInChannelByTitle(undefined, 'Hello World');

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
      const result = await getAllEmbedMessagesInChannelByTitle(channel, 'Hello World');

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toContain(message1);
      expect(result).toContain(message3);
    });
    test('should return undefined if channel is undefined', async () => {
      // Act
      const result = await getAllEmbedMessagesInChannelByTitle(undefined, 'Hello World');

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
      const result = await getAllEmbedMessagesInChannelByTitle(channel, 'Hello World');

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
