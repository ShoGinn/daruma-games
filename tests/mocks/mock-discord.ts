/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';
import {
    Client,
    Collection,
    CommandInteraction,
    Guild,
    GuildMember,
    Message,
    TextChannel,
    User,
} from 'discord.js';
import { RawCommandInteractionData } from 'discord.js/typings/rawDataTypes.js';
import { Client as ClientX } from 'discordx';
import { singleton } from 'tsyringe';

import { mockTextChannel } from './djs-mock/channel-mock.js';
import { mockGuild } from './djs-mock/guild-mock.js';
import { mockUser } from './djs-mock/user-mock.js';

@singleton()
export class Mock {
    private client!: Client;
    private guild!: Guild;
    private channel!: TextChannel;
    private textChannel!: TextChannel;
    private guildMember!: GuildMember;
    private guildMemberBot!: GuildMember;
    private user!: User;
    private userBot!: User;
    private message!: Message;

    getClient(withBots: boolean = false): Client {
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
        this.mockUserBot();
        this.mockGuildMember();
        this.mockGuildMemberBot();
        this.mockChannel();
        this.mockMessage('mocked message');

        // mock cache
    }

    private mockClient(): void {
        this.client = new ClientX({ intents: [], guards: [] });
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
    private mockUserBot(): void {
        this.userBot = Reflect.construct(User, [
            this.client,
            {
                id: 'user-id-bot',
                username: 'test-bot',
                discriminator: 'test-bot#0000',
                avatar: null,
                bot: true,
            },
        ]);
    }

    private mockGuildMemberBot(): void {
        this.guildMemberBot = Reflect.construct(GuildMember, [
            this.client,
            {
                id: BigInt(1),
                deaf: false,
                mute: false,
                self_mute: false,
                bot: true,
                self_deaf: false,
                session_id: 'session-id',
                channel_id: 'channel-id',
                nick: 'nick-bot',
                joined_at: new Date('2020-01-01').getTime(),
                user: this.userBot,
                roles: [],
            },
            this.guild,
        ]);
    }

    private mockGuildMember(): void {
        this.guildMember = Reflect.construct(GuildMember, [
            this.client,
            {
                id: BigInt(1),
                deaf: false,
                mute: false,
                self_mute: false,
                self_deaf: false,
                session_id: 'session-id',
                channel_id: 'channel-id',
                nick: 'nick',
                joined_at: new Date('2020-01-01').getTime(),
                user: this.user,
                roles: [],
            },
            this.guild,
        ]);
    }

    private mockMessage(content: string): void {
        this.message = Reflect.construct(Message, [
            this.client,
            {
                id: BigInt(10),
                type: 'DEFAULT',
                content: content,
                author: this.user,
                webhook_id: null,
                member: this.guildMember,
                pinned: false,
                tts: false,
                nonce: 'nonce',
                embeds: [],
                attachments: [],
                edited_timestamp: null,
                reactions: [],
                mentions: [],
                mention_roles: [],
                mention_everyone: [],
                hit: false,
            },
            this.textChannel,
        ]);

        this.message.inGuild = jest.fn(() => true);

        this.message.react = jest.fn() as any;
        this.message.edit = jest.fn() as any;
        this.message.delete = jest.fn() as any;
    }

    public mockCommandInteraction<T extends RawCommandInteractionData['data']>(
        commandData: T
    ): CommandInteraction {
        const interaction = Reflect.construct(CommandInteraction, [
            this.client,
            {
                data: commandData,
                id: BigInt(1),
                user: this.guildMember,
            },
        ]);

        interaction.guildId = this.guild.id;

        interaction.followUp = jest.fn(() => Promise.resolve(this.message)) as any;
        interaction.editReply = jest.fn(() => Promise.resolve(this.message)) as any;
        interaction.reply = jest.fn(() => Promise.resolve(this.message)) as any;
        interaction.isCommand = jest.fn(() => true);
        interaction.member = this.guildMember;

        return interaction;
    }
}
