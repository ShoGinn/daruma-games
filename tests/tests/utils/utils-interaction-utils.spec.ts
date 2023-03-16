import {
    APIInteractionGuildMember,
    Colors,
    MessageContextMenuCommandInteraction,
} from 'discord.js';
import { container } from 'tsyringe';

import { InteractionUtils } from '../../../src/utils/utils.js';
import { Mock } from '../../mocks/mock-discord.js';

describe('Interaction Utils', () => {
    const mock = container.resolve(Mock);
    const interactionData = {
        id: '123456789',
        name: 'test',
        type: 2,
        options: [
            {
                name: 'option',
                type: 3,
                value: 'test',
            },
        ],
    };
    describe('simpleSuccessEmbed', () => {
        it('should send a success embed', async () => {
            const interaction = mock.mockCommandInteraction(interactionData);
            const message = 'Test message';
            await InteractionUtils.simpleSuccessEmbed(interaction, message);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: [{ data: { title: `✅ ${message}`, color: Colors.Green } }],
            });
        });
    });
    describe('simpleErrorEmbed', () => {
        it('should send a Error embed', async () => {
            const interaction = mock.mockCommandInteraction(interactionData);
            const message = 'Test message';
            await InteractionUtils.simpleErrorEmbed(interaction, message);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: [{ data: { title: `❌ ${message}`, color: Colors.Red } }],
            });
        });
    });
    describe('getInteractionCaller', () => {
        it('should return the guild member from the interaction', () => {
            const interaction = mock.mockCommandInteraction(interactionData);

            const result = InteractionUtils.getInteractionCaller(interaction);

            expect(result.id).toEqual('user-id');
        });

        it('should throw an error if the member is null', () => {
            const interaction = mock.mockCommandInteraction(interactionData);
            interaction.member = null;

            expect(() => InteractionUtils.getInteractionCaller(interaction)).toThrowError(
                'Unable to extract member'
            );

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(interaction.reply).toHaveBeenCalledWith('Unable to extract member');
        });
        it('should throw an error if the member is not a guildmember', () => {
            expect.assertions(1);
            const interaction = mock.mockCommandInteraction(interactionData);
            interaction.member = {
                user: interaction.user,
                deaf: false,
                mute: false,
                self_deaf: false,
                self_mute: false,
                suppress: false,
                permissions: 'ADMINISTRATOR',
                joined_at: '2021-01-01T00:00:00.000Z',
                roles: [],
            } as unknown as APIInteractionGuildMember;
            expect(() => InteractionUtils.getInteractionCaller(interaction)).toThrowError(
                'Unable to extract member'
            );

            // eslint-disable-next-line @typescript-eslint/unbound-method
            //expect(interaction.reply).toHaveBeenCalledWith('Unable to extract member');
        });
    });
    describe('replyOrFollowUp', () => {
        it('should reply if interaction is not yet handled', async () => {
            const interaction = mock.mockCommandInteraction(interactionData);
            interaction.replied = false;
            interaction.deferred = false;

            await InteractionUtils.replyOrFollowUp(interaction, 'Reply');

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(interaction.reply).toHaveBeenCalledWith('Reply');
        });

        it('should follow up if interaction is already replied', async () => {
            const interaction = mock.mockCommandInteraction(interactionData);
            interaction.replied = true;
            interaction.deferred = false;

            await InteractionUtils.replyOrFollowUp(interaction, 'Follow up');

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(interaction.followUp).toHaveBeenCalledWith('Follow up');
        });

        it('should edit reply if interaction is deferred but not yet replied', async () => {
            const interaction = mock.mockCommandInteraction(interactionData);
            interaction.replied = false;
            interaction.deferred = true;

            await InteractionUtils.replyOrFollowUp(interaction, 'Edit reply');

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(interaction.editReply).toHaveBeenCalledWith('Edit reply');
        });
    });
    describe('getMessageFromContextInteraction', () => {
        it('should fetch the message from the interaction target ID', async () => {
            // Mock the interaction
            const interaction = {
                targetId: '1234',
                channel: {
                    messages: {
                        fetch: jest.fn().mockResolvedValue({ id: '1234' }),
                    },
                },
            } as unknown as MessageContextMenuCommandInteraction;

            // Call getMessageFromContextInteraction
            const result = await InteractionUtils.getMessageFromContextInteraction(interaction);

            // Assert that the message returned is the mock message
            expect(result).toBeDefined();
            expect(result?.id).toEqual('1234');
        });
        it('should return undefined if interaction has no channel', async () => {
            const mockInteraction = {
                targetId: '123',
                channel: null,
            } as unknown as MessageContextMenuCommandInteraction;

            const message = await InteractionUtils.getMessageFromContextInteraction(
                mockInteraction
            );

            expect(message).toBeUndefined();
        });
    });
});
