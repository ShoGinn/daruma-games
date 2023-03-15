import { Guild } from 'discord.js';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { fetchGuild, getDevelopers, isDeveloper } from '../../../src/utils/Utils.js';
import { Mock } from '../../mocks/mockDiscord.js';

describe('Discord Utils', () => {
    let client: Client;
    let mock: Mock;
    let guild: Guild;
    beforeAll(() => {
        process.env.BOT_OWNER_ID = 'BOT_OWNER_ID';

        mock = container.resolve(Mock);
        client = mock.getClient() as Client;
        guild = mock.getGuild();
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
                process.env.BOT_OWNER_ID = '123';
                expect(getDevelopers()).toHaveLength(1);
            });
        });
    });
    describe('isDev', () => {
        it('should return true if the user is a developer', () => {
            process.env.BOT_OWNER_ID = '123';
            expect(isDeveloper('123')).toBe(true);
        });
        it('should return false if the user is not a developer', () => {
            process.env.BOT_OWNER_ID = '123';
            expect(isDeveloper('456')).toBe(false);
        });
    });
    describe('fetchGuild', () => {
        it('should return a guild', async () => {
            const fetchedGuild = await fetchGuild(guild.id, client);
            expect(fetchedGuild?.id).toBe(guild.id);
        });
        it('should return undefined if the guild does not exist', async () => {
            client.guilds.fetch = jest.fn().mockRejectedValueOnce(undefined);
            const fetchedGuild = await fetchGuild('123456789', client);
            expect(fetchedGuild).toBeNull();
        });
    });
});
