import { Client, Guild, PermissionFlagsBits } from 'discord.js';

import { mockGuild } from './guild-mock.js';
import { mockGuildMember } from './user-mock.js';

export type GuildMemberVariants = Awaited<ReturnType<typeof createGuildMemberVariants>>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createGuildMemberVariants(client: Client, guild: Guild | undefined) {
    if (!guild) {
        guild = mockGuild(client);
    }
    const guildMemberOwner = await guild.members.fetch(guild.ownerId);
    const guildMemberDefault = mockGuildMember({ client, guild });
    const pendingGuildMemberDefault = mockGuildMember({
        client,
        guild,
        data: {
            pending: true,
        },
    });
    const guildMemberManageGuild = mockGuildMember({
        client,
        guild,
        permissions: PermissionFlagsBits.ManageGuild,
    });
    const guildMemberAdmin = mockGuildMember({
        client,
        guild,
        permissions: PermissionFlagsBits.Administrator,
    });

    return {
        guildMemberOwner,
        guildMemberDefault,
        pendingGuildMemberDefault,
        guildMemberManageGuild,
        guildMemberAdmin,
    };
}
