/* eslint-disable @typescript-eslint/unbound-method */
import { TextChannel } from 'discord.js';

import { Client } from 'discordx';

import { mockTextChannel, setupBot } from '@shoginn/discordjs-mock';
import { anything, instance, mock, verify, when } from 'ts-mockito';

import { ChannelSettings } from '../../types/daruma-training.js';

import { EmbedManager } from './dt-embedmanager.js';
import { GameState } from './dt-game-state.js';
import { Game } from './dt-game.js';
import { WaitingRoomManager } from './dt-waitingroommanager.js';

describe('WaitingRoomManager', () => {
  let waitingRoomManager: WaitingRoomManager;
  let client: Client;
  let channel: TextChannel;
  let game: Game;
  let mockedGame: Game;
  let embedManager: EmbedManager;
  let mockedEmbedManager: EmbedManager;
  beforeEach(async () => {
    client = (await setupBot()) as Client;
    channel = mockTextChannel(client);

    // Arrange
    game = mock(Game);
    mockedGame = instance(game);
    embedManager = mock(EmbedManager);
    mockedEmbedManager = instance(embedManager);
    when(game.embedManager).thenReturn(mockedEmbedManager);
    waitingRoomManager = new WaitingRoomManager();
    when(embedManager.sendJoinWaitingRoomEmbed(anything())).thenResolve();

    when(game.settings).thenReturn({ channelId: channel.id } as unknown as ChannelSettings);
    when(game.state).thenReturn({
      status: 'waitingRoom',
    } as unknown as Game['_state'] as GameState);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('initialize', () => {
    test('should initialize the waiting room channel', async () => {
      // Act
      await waitingRoomManager.initialize(mockedGame, mockTextChannel(client));
      // Assert
      verify(embedManager.sendJoinWaitingRoomEmbed(anything())).once();
    });
  });
  describe('sendToChannel', () => {
    test('should send a message to the waiting room channel', async () => {
      // Arrange
      const content = 'Test message';
      await waitingRoomManager.initialize(mockedGame, mockTextChannel(client));

      // Act
      const result = await waitingRoomManager.sendToChannel(content);

      // Assert
      expect(result).toEqual(expect.objectContaining({ content }));
    });

    test('should return undefined when sending a message to a non-existent waiting room channel', async () => {
      // Act
      const result = await waitingRoomManager.sendToChannel('Test message');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('stopWaitingRoomOnceGameEnds', () => {
    test('should stop the waiting room once the game ends', async () => {
      // Arrange
      await waitingRoomManager.initialize(mockedGame, mockTextChannel(client));
      // Act
      await waitingRoomManager.stopWaitingRoomOnceGameEnds();

      // Assert
      verify(embedManager.sendJoinWaitingRoomEmbed(anything())).twice();
    });

    test('should not stop the waiting room if the game is not in the waiting room state', async () => {
      // Arrange
      when(game.state).thenReturn({ status: 'activeGame' } as unknown as Game['state']);
      // Act
      await waitingRoomManager.stopWaitingRoomOnceGameEnds();

      // Assert
      verify(embedManager.sendJoinWaitingRoomEmbed(anything())).never();
    });
  });
});
