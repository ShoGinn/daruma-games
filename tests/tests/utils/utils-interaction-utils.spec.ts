import {
  APIInteractionGuildMember,
  Client,
  Colors,
  MessageContextMenuCommandInteraction,
} from 'discord.js';

import { mockChatInputCommandInteraction } from '@shoginn/discordjs-mock';
import { container } from 'tsyringe';

import { InteractionUtils } from '../../../src/utils/utils.js';
import { Mock } from '../../mocks/mock-discord.js';

let interactionData: {
  client: Client;
  id: string;
  name: string;
};
beforeAll(() => {
  const mock = container.resolve(Mock);
  const client = mock.getClient();
  interactionData = {
    client,
    id: 'test',
    name: 'test',
  };
});

describe('Interaction Utils', () => {
  describe('simpleSuccessEmbed', () => {
    test('should send a success embed', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);
      const message = 'Test message';
      const successEmbed = await InteractionUtils.simpleSuccessEmbed(interaction, message);
      expect(successEmbed.embeds).toHaveLength(1);
      expect(successEmbed.embeds[0].title).toBe(`:white_check_mark: ${message}`);
      expect(successEmbed.embeds[0].color).toEqual(Colors.Green);
    });
  });
  describe('simpleErrorEmbed', () => {
    test('should send a Error embed', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);
      const message = 'Test message';
      const errorEmbed = await InteractionUtils.simpleErrorEmbed(interaction, message);
      expect(errorEmbed.embeds).toHaveLength(1);
      expect(errorEmbed.embeds[0].title).toBe(`:x: ${message}`);
      expect(errorEmbed.embeds[0].color).toEqual(Colors.Red);
    });
  });
  describe('getInteractionCaller', () => {
    test('should return the guild member from the interaction', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);

      const result = await InteractionUtils.getInteractionCaller(interaction);

      expect(result.avatar).toBe('user avatar url');
    });

    test('should throw an error if the member is null', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);
      interaction.member = null;
      await expect(InteractionUtils.getInteractionCaller(interaction)).rejects.toThrow(
        'Unable to extract member',
      );
    });
    test('should throw an error if the member is not a guild member', async () => {
      expect.assertions(1);
      const interaction = mockChatInputCommandInteraction(interactionData);
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
      await expect(InteractionUtils.getInteractionCaller(interaction)).rejects.toThrow(
        'Unable to extract member',
      );
    });
  });
  describe('replyOrFollowUp', () => {
    test('should reply if interaction is not yet handled', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);
      expect(interaction.deferred).toBeFalsy();
      expect(interaction.replied).toBeFalsy();
      await InteractionUtils.replyOrFollowUp(interaction, {
        content: 'Reply',
        fetchReply: true,
      });
      expect(interaction.deferred).toBeFalsy();
      expect(interaction.replied).toBeTruthy();
    });

    test('should follow up if interaction is already replied', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);
      expect(interaction.deferred).toBeFalsy();
      expect(interaction.replied).toBeFalsy();
      await InteractionUtils.replyOrFollowUp(interaction, 'Reply');
      expect(interaction.deferred).toBeFalsy();
      expect(interaction.replied).toBeTruthy();
      await InteractionUtils.replyOrFollowUp(interaction, 'Follow up');
    });

    test('should edit reply if interaction is deferred but not yet replied', async () => {
      const interaction = mockChatInputCommandInteraction(interactionData);
      expect(interaction.deferred).toBeFalsy();
      expect(interaction.replied).toBeFalsy();
      await interaction.deferReply();
      expect(interaction.deferred).toBeTruthy();
      await InteractionUtils.replyOrFollowUp(interaction, 'Edit reply');
    });
  });
  describe('getMessageFromContextInteraction', () => {
    test('should fetch the message from the interaction target ID', async () => {
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
      expect(result?.id).toBe('1234');
    });
    test('should return undefined if interaction has no channel', async () => {
      const mockInteraction = {
        targetId: '123',
        channel: null,
      } as unknown as MessageContextMenuCommandInteraction;

      const message = await InteractionUtils.getMessageFromContextInteraction(mockInteraction);

      expect(message).toBeUndefined();
    });
  });
});
