/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';
import { Client, Guild, TextChannel, User } from 'discord.js';
import { Client as ClientX } from 'discordx';
import { singleton } from 'tsyringe';

import { mockTextChannel } from './djs-mock/channel-mock.js';
import { mockGuild } from './djs-mock/guild-mock.js';
import { mockClientUser, mockGuildMember, mockUser } from './djs-mock/user-mock.js';

@singleton()
export class Mock {
    private client!: Client;
    private guild!: Guild;
    private channel!: TextChannel;
    private user!: User;

    getClient(withBots: boolean = false): Client {
        if (withBots) {
            const botUser = mockUser(this.client, { bot: true });
            mockGuildMember({ client: this.client, user: botUser, guild: this.guild });
        }
        return this.client;
    }
    getUser(): User {
        return this.user;
    }
    getGuild(): Guild {
        return this.guild;
    }
    constructor() {
        this.mockClient();
        this.mockGuild();
        this.mockUser();
        this.mockChannel();
    }

    private mockClient(): void {
        this.client = new ClientX({ intents: [], guards: [] });
        mockClientUser(this.client);

        this.client.login = jest.fn(() => Promise.resolve('LOGIN_TOKEN')) as any;
    }

    private mockGuild(): void {
        this.guild = mockGuild(this.client);
    }
    private mockChannel(): void {
        this.channel = mockTextChannel(this.client, this.guild);
    }

    private mockUser(): void {
        this.user = mockUser(this.client);
    }
}
