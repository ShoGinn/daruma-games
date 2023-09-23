import { Guild } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import {
    fetchGuild,
    getAdminChannel,
    getDevelopers,
    isDeveloper,
    sendMessageToAdminChannel,
} from '../../../src/utils/utils.js';
import { Mock } from '../../mocks/mock-discord.js';

describe('Discord Utils', () => {
    let client: Client;
    let mock: Mock;
    let guild: Guild;
    beforeAll(() => {
        process.env['BOT_OWNER_ID'] = 'BOT_OWNER_ID';

        mock = container.resolve(Mock);
        client = mock.getClient() as Client;
        guild = mock.getGuild();
        const adminChannel = guild.channels.cache.first();
        process.env['ADMIN_CHANNEL_ID'] = adminChannel?.id || '';
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('Developer Commands', () => {
        describe('getDeveloperCommands', () => {
            it('should return an array of developer commands', () => {
                const devs = getDevelopers();
                expect(devs).toHaveLength(1);
                expect(devs).toContain('BOT_OWNER_ID');
                process.env['BOT_OWNER_ID'] = '123';
                expect(getDevelopers()).toHaveLength(1);
            });
        });
    });
    describe('isDev', () => {
        it('should return true if the user is a developer', () => {
            process.env['BOT_OWNER_ID'] = '123';
            expect(isDeveloper('123')).toBe(true);
        });
        it('should return false if the user is not a developer', () => {
            process.env['BOT_OWNER_ID'] = '123';
            expect(isDeveloper('456')).toBe(false);
        });
    });
    describe('fetchGuild', () => {
        it('should return a guild', async () => {
            const fetchedGuild = await fetchGuild(guild.id, client);
            expect(fetchedGuild?.id).toBe(guild.id);
        });
        it('should return undefined if the guild does not exist', async () => {
            client.guilds.fetch = jest.fn().mockRejectedValueOnce(null);
            const fetchedGuild = await fetchGuild('123456789', client);
            expect(fetchedGuild).toBeNull();
        });
    });
    describe('getAdminChannel', () => {
        it('should return the admin channel', () => {
            const adminChannel = getAdminChannel();
            expect(adminChannel).toBe(process.env['ADMIN_CHANNEL_ID']);
        });
    });
    describe('sendMessageToAdminChannel', () => {
        it('should send a message to the admin channel', async () => {
            const message = 'test message';
            const sent = await sendMessageToAdminChannel(message, client);
            expect(sent).toBeTruthy();
        });
        it('should return false if the admin channel does not exist', async () => {
            process.env['ADMIN_CHANNEL_ID'] = '123456789';
            const message = 'test message';
            const sent = await sendMessageToAdminChannel(message, client);
            expect(sent).toBeFalsy();
        });
        it('should return false if there are no guilds', async () => {
            client.guilds.cache.clear();
            const message = 'test message';
            const sent = await sendMessageToAdminChannel(message, client);
            expect(sent).toBeFalsy();
        });
    });
});
