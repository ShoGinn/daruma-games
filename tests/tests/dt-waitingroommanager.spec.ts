/* eslint-disable @typescript-eslint/unbound-method */
import { TextChannel } from 'discord.js';

import { mockTextChannel, setupBot } from '@shoginn/discordjs-mock';
import { anything, instance, mock, verify, when } from 'ts-mockito';

import { DarumaTrainingChannelService } from '../../src/services/dt-channel.js';
import { ChannelSettings } from '../../src/types/daruma-training.js';
import { EmbedManager } from '../../src/utils/classes/dt-embedmanager.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { WaitingRoomManager } from '../../src/utils/classes/dt-waitingroommanager.js';

describe('WaitingRoomManager', () => {
  let waitingRoomManager: WaitingRoomManager;
  let client;
  let channel: TextChannel;
  let game: Game;
  let mockedGame: Game;
  let embedManager: EmbedManager;
  let mockedEmbedManager: EmbedManager;
  let mockDarumaTrainingChannelService: DarumaTrainingChannelService;
  let mockedDaruamTrainingChannelService: DarumaTrainingChannelService;
  beforeEach(async () => {
    client = await setupBot();
    channel = mockTextChannel(client);

    // Arrange
    game = mock(Game);
    mockedGame = instance(game);
    embedManager = mock(EmbedManager);
    mockedEmbedManager = instance(embedManager);
    mockDarumaTrainingChannelService = mock(DarumaTrainingChannelService);
    mockedDaruamTrainingChannelService = instance(mockDarumaTrainingChannelService);
    when(game.embedManager).thenReturn(mockedEmbedManager);
    waitingRoomManager = new WaitingRoomManager(client, mockedDaruamTrainingChannelService);
    when(embedManager.sendJoinWaitingRoomEmbed(anything())).thenResolve();

    when(game.settings).thenReturn({ channelId: channel.id } as unknown as ChannelSettings);
    when(game.state).thenReturn({ status: 'waitingRoom' } as unknown as Game['_state']);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('initialize', () => {
    test('should initialize the waiting room channel', async () => {
      // Act
      await waitingRoomManager.initialize(mockedGame);
      // Assert
      verify(embedManager.sendJoinWaitingRoomEmbed(anything())).once();
    });

    test('should attempt to remove the channel since it does not exist', async () => {
      // Arrange
      when(game.settings).thenReturn({ channelId: 1234 } as unknown as ChannelSettings);
      // Act
      await waitingRoomManager.initialize(mockedGame);

      // Assert
      verify(embedManager.sendJoinWaitingRoomEmbed(anything())).never();
      verify(mockDarumaTrainingChannelService.deleteChannelById(anything())).once();
    });
  });
  describe('sendToChannel', () => {
    test('should send a message to the waiting room channel', async () => {
      // Arrange
      const content = 'Test message';
      await waitingRoomManager.initialize(mockedGame);

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
      await waitingRoomManager.initialize(mockedGame);
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
