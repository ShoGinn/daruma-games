import { Guild, GuildBasedChannel } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { getConfig } from '../../../src/config/config.js';
import {
  fetchGuild,
  getAdminChannel,
  getDeveloperMentions,
  getDevelopers,
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
});
