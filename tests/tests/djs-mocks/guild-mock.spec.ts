import { setupBot } from '../../mocks/djs-mock/client-mock.js';
import { mockGuild } from '../../mocks/djs-mock/guild-mock.js';
import { mockUser } from '../../mocks/djs-mock/user-mock.js';

describe('Guild Mock', () => {
    it('should create a guild', async () => {
        const client = await setupBot();
        const guild = mockGuild(client);
        expect(guild).toBeDefined();
        expect(client.guilds.cache.get(guild.id)).toBeDefined();
        expect(guild.ownerId).toBeDefined();
        expect(client.users.cache.get(guild.ownerId)).toBeDefined();
        expect(guild.members.cache.get(guild.ownerId)).toBeDefined();
    });
    it('should create a guild with a custom owner', async () => {
        const client = await setupBot();
        const owner = mockUser(client);
        const guild = mockGuild(client, owner);
        expect(guild).toBeDefined();
        expect(client.guilds.cache.get(guild.id)).toBeDefined();
        expect(guild.ownerId).toBeDefined();
        expect(client.users.cache.get(guild.ownerId)).toBeDefined();
        expect(guild.members.cache.get(guild.ownerId)).toBeDefined();
    });
    it('should create a user and then a guild ', async () => {
        const client = await setupBot();
        const randomUser = mockUser(client);
        const guild = mockGuild(client);
        expect(guild).toBeDefined();
        expect(client.guilds.cache.get(guild.id)).toBeDefined();
        expect(guild.ownerId).toBeDefined();
        expect(client.users.cache.get(guild.ownerId)).toBeDefined();
        expect(randomUser.id).not.toBe(guild.ownerId);
        expect(guild.members.cache.get(guild.ownerId)).toBeDefined();
        expect(client.users.cache.size).toBe(3);
        expect(guild.members.cache.size).toBe(2);
        expect(guild.members.cache.get(randomUser.id)).toBeUndefined();
    });
    it('should have a @everyone default role', async () => {
        const client = await setupBot();
        const guild = mockGuild(client);
        expect(guild.roles.cache.get(guild.id)).toBeDefined();
        expect(guild.roles.everyone).toBeDefined();
    });
});
