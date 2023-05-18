import type { Client, GuildMember, Message } from 'discord.js';

import { mockTextChannel } from '../../mocks/djs-mock/channel-mock.js';
import { setupBot } from '../../mocks/djs-mock/client-mock.js';
import {
    mockButtonInteraction,
    mockChatInputCommandInteraction,
    mockStringSelectInteraction,
} from '../../mocks/djs-mock/interaction-mock.js';
import { mockMessage } from '../../mocks/djs-mock/message-mock.js';
import { mockGuildMember } from '../../mocks/djs-mock/user-mock.js';
let client: Client;
beforeEach(async () => {
    client = await setupBot();
});

describe('Interaction Mock', () => {
    describe('Chat input command interaction', () => {
        it('should reply', async () => {
            const interaction = mockChatInputCommandInteraction({
                client,
                id: 'test',
                name: 'test',
            });
            const response = await interaction.reply({
                content: 'hello',
                fetchReply: true,
            });
            expect(response.content).toBe('hello');
        });
        it('should follow up', async () => {
            const interaction = mockChatInputCommandInteraction({
                client,
                id: 'test',
                name: 'test',
            });
            const initialReply = await interaction.reply({
                content: 'hello',
                fetchReply: true,
            });
            expect(initialReply.content).toBe('hello');
            const response = await interaction.followUp({
                content: 'hello',
                fetchReply: true,
            });
            expect(response.content).toBe('hello');
        });
        it('should defer', async () => {
            const interaction = mockChatInputCommandInteraction({
                client,
                id: 'test',
                name: 'test',
            });
            await interaction.reply({
                content: 'hello',
                fetchReply: true,
            });
            const defer = await interaction.deferReply({
                fetchReply: true,
            });
            expect(defer.id).toBe(interaction.id.toString());
        });
        it('should edit deferred reply', async () => {
            const interaction = mockChatInputCommandInteraction({
                client,
                id: 'test',
                name: 'test',
            });
            const firstReply = await interaction.reply({
                content: 'hello',
                fetchReply: true,
            });
            expect(firstReply.content).toBe('hello');
            await interaction.deferReply({
                fetchReply: true,
            });
            const updated = await interaction.editReply('world');
            expect(updated.content).toBe('world');
        });
        it('should edit reply', async () => {
            const interaction = mockChatInputCommandInteraction({
                client,
                id: 'test',
                name: 'test',
            });
            await interaction.reply({
                content: 'hello',
                fetchReply: true,
            });
            const updated = await interaction.editReply('world');
            expect(updated.content).toBe('world');
        });
        it('should fetch the reply', async () => {
            const interaction = mockChatInputCommandInteraction({
                client,
                id: 'test',
                name: 'test',
            });
            await interaction.reply({
                content: 'hello',
                fetchReply: true,
            });
            const reply = await interaction.fetchReply();
            expect(reply.content).toBe('hello');
        });
    });
    describe('Button Interaction', () => {
        let message: Message;
        let caller: GuildMember;
        beforeEach(() => {
            caller = mockGuildMember({
                client,
            });
            const channel = mockTextChannel(client, caller.guild);
            message = mockMessage({
                client,
                author: caller.user,
                channel,
            });
        });
        it('should create a mocked button interaction', async () => {
            const expectedId = 'test.js';
            const interaction = mockButtonInteraction({
                caller: caller.user,
                message,
                override: {
                    custom_id: expectedId,
                },
            });
            await interaction.update('test');
            expect(interaction.message.content).toBe('test');
            expect(interaction.replied).toBe(true);
        });
        it('should deffer the button interaction', async () => {
            const expectedId = 'test.js';
            const interaction = mockButtonInteraction({
                caller: caller.user,
                message,
                override: {
                    custom_id: expectedId,
                },
            });
            await interaction.deferUpdate();
            expect(interaction.deferred).toBe(true);
        });
        it('should edit a button interaction reply', async () => {
            const interaction = mockButtonInteraction({
                caller: caller.user,
                message,
            });
            await interaction.reply('hello');
            await interaction.editReply('world');
            expect(interaction.message.content).toBe('world');
            expect(interaction.replied).toBe(true);
        });
        it('should reply to a button interaction', async () => {
            const interaction = mockButtonInteraction({
                caller: caller.user,
                message,
            });
            const reply = await interaction.reply({
                fetchReply: true,
                content: 'hello',
            });

            expect(reply.content).toBe('hello');
            expect(interaction.replied).toBe(true);
        });
        it('should clear defer of a button interaction on reply', async () => {
            const interaction = mockButtonInteraction({
                caller: caller.user,
                message,
            });
            await interaction.deferUpdate();
            await interaction.reply('hello');
            expect(interaction.deferred).toBe(false);
            expect(interaction.replied).toBe(true);
        });
        it('should set replied on reply to an interaction', async () => {
            const interaction = mockButtonInteraction({
                caller: caller.user,
                message,
            });
            await interaction.reply('hello');
            expect(interaction.replied).toBe(true);
        });
    });
    describe('String Select Interaction', () => {
        let message: Message;
        let caller: GuildMember;
        beforeEach(() => {
            caller = mockGuildMember({
                client,
            });
            const channel = mockTextChannel(client, caller.guild);
            message = mockMessage({
                client,
                channel,
            });
        });
        it('should create a mocked string select interaction', async () => {
            const interaction = mockStringSelectInteraction({
                caller: caller.user,
                message,
                data: {
                    custom_id: 'test',
                    values: 'test',
                },
            });
            await interaction.update('test');
            expect(interaction.message.content).toBe('test');
            expect(interaction.replied).toBe(true);
        });
        it('should defer the string select interaction', async () => {
            const interaction = mockStringSelectInteraction({
                caller: caller.user,
                message,
                data: {
                    custom_id: 'test',
                    values: 'test',
                },
            });
            await interaction.deferUpdate();
            expect(interaction.deferred).toBe(true);
        });
        it('should edit a string select interaction reply', async () => {
            const interaction = mockStringSelectInteraction({
                caller: caller.user,
                message,
                data: {
                    custom_id: 'test',
                    values: 'test',
                },
            });
            await interaction.reply('hello');
            await interaction.editReply('world');
            expect(interaction.message.content).toBe('world');
            expect(interaction.replied).toBe(true);
        });
        it('should reply to a string select interaction', async () => {
            const interaction = mockStringSelectInteraction({
                caller: caller.user,
                message,
                data: {
                    custom_id: 'test',
                    values: 'test',
                },
            });
            const reply = await interaction.reply({
                fetchReply: true,
                content: 'hello',
            });

            expect(reply.content).toBe('hello');
            expect(interaction.replied).toBe(true);
        });
        it('should clear defer of a string select interaction on reply', async () => {
            const interaction = mockStringSelectInteraction({
                caller: caller.user,
                message,
                data: {
                    custom_id: 'test',
                    values: 'test',
                },
            });
            await interaction.deferUpdate();
            await interaction.reply('hello');
            expect(interaction.deferred).toBe(false);
            expect(interaction.replied).toBe(true);
        });
        it('should select multiple values', () => {
            const interaction = mockStringSelectInteraction({
                caller: caller.user,
                message,
                data: {
                    custom_id: 'test',
                    values: ['test', 'test2'],
                },
            });
            expect(interaction.values).toEqual(['test', 'test2']);
        });
    });
});
