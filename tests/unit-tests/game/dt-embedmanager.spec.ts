/* eslint-disable @typescript-eslint/unbound-method */
import { Message } from 'discord.js';

import { anything, instance, mock, resetCalls, verify, when } from 'ts-mockito';

import { GameStatus, GameTypes } from '../../../src/enums/daruma-training.js';
import { MaintenanceService } from '../../../src/services/maintenance.js';
import { EmbedManager } from '../../../src/utils/classes/dt-embedmanager.js';
import { GameState } from '../../../src/utils/classes/dt-game-state.js';
import { Game } from '../../../src/utils/classes/dt-game.js';
import { WaitingRoomManager } from '../../../src/utils/classes/dt-waitingroommanager.js';
import * as dtEmbeds from '../../../src/utils/functions/dt-embeds.js';
import { mockChannelSettings } from '../../setup/fake-mocks.js';

// import { DarumaTrainingGameRepository } from '../../src/repositories/dt-game-repository.js';
describe('EmbedManager', () => {
  let embedManager: EmbedManager;
  let game: Game;
  let gameInstance: Game;
  let waitingRoomManager: WaitingRoomManager;
  let mockMaintenanceService: MaintenanceService;
  let gameState: GameState;
  let doEmbedSpy: jest.SpyInstance;
  let postGameWinEmbedsSpy: jest.SpyInstance;
  beforeEach(() => {
    // Arrange
    doEmbedSpy = jest.spyOn(dtEmbeds, 'doEmbed');
    postGameWinEmbedsSpy = jest.spyOn(dtEmbeds, 'postGameWinEmbeds');

    mockMaintenanceService = mock(MaintenanceService);
    embedManager = new EmbedManager(instance(mockMaintenanceService));

    game = mock(instance(Game));
    gameInstance = instance(game);
    waitingRoomManager = mock(WaitingRoomManager);
    gameState = new GameState(mockChannelSettings(GameTypes.OneVsNpc).token, undefined);

    when(game.waitingRoomManager).thenReturn(instance(waitingRoomManager));
    when(waitingRoomManager.sendToChannel(anything())).thenResolve({} as unknown as Message);

    when(game.state).thenReturn(gameState);
    gameState.reset = jest.fn().mockReturnValue({ ...gameState, status: GameStatus.waitingRoom });
    gameState.finishGame = jest.fn().mockReturnValue({ ...gameState, status: GameStatus.win });
    gameState.maintenance = jest
      .fn()
      .mockReturnValue({ ...gameState, status: GameStatus.maintenance });
  });
  afterEach(() => {
    jest.clearAllMocks();
    resetCalls(waitingRoomManager);
  });
  describe('reset', () => {
    test('should reset the embed manager', () => {
      embedManager.waitingRoomEmbed = { blah: 'test' } as unknown as Message;
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      embedManager['reset']();
      expect(embedManager.waitingRoomEmbed).toBeUndefined();
    });
  });
  describe('sendEmbed', () => {
    test('should generate a mock embed and attempt to send it', async () => {
      // Arrange
      // Act
      const result = await embedManager['sendEmbed'](gameInstance);
      // Assert
      expect(result).toBeDefined();
      verify(waitingRoomManager.sendToChannel(anything())).once();
      expect(doEmbedSpy).toHaveBeenCalledTimes(1);
    });
  });
  describe('updateMessage', () => {
    test('should update the message', async () => {
      // Arrange
      const message = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager['updateMessage'](gameInstance, message);
      // Assert
      expect(message.edit).toHaveBeenCalledTimes(1);
      expect(doEmbedSpy).toHaveBeenCalledTimes(1);
    });
    test('should not update the message if an error occurs', async () => {
      // Arrange
      const message = { edit: jest.fn(() => Promise.reject()) } as unknown as Message;
      // Act
      await embedManager['updateMessage'](gameInstance, message);
      // Assert
      expect(message.edit).toHaveBeenCalledTimes(1);
      expect(doEmbedSpy).toHaveBeenCalledTimes(1);
    });
  });
  describe('sendWinEmbeds', () => {
    test('should send the win embeds', async () => {
      // Arrange
      // Act
      await embedManager['sendWinEmbeds'](gameInstance);
      // Assert
      verify(waitingRoomManager.sendToChannel(anything())).twice();
      expect(postGameWinEmbedsSpy).toHaveBeenCalledTimes(1);
    });
  });
  describe('startGame', () => {
    test('should delete the waiting room message and send the game embed', async () => {
      // Arrange
      // Act
      await embedManager.startGame(gameInstance);
      // Assert
      expect(embedManager.activeGameEmbed).toBeDefined();
    });
  });
  describe('finishGame', () => {
    test('should send the win embeds, update the game embed, and send the join waiting room embed', async () => {
      // Arrange
      embedManager.activeGameEmbed = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager.finishGame(gameInstance);
      // Assert
      expect(embedManager.activeGameEmbed).toBeUndefined();
      expect(postGameWinEmbedsSpy).toHaveBeenCalledTimes(1);
      verify(waitingRoomManager.sendToChannel(anything())).thrice();
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
    });
    test('should not update the game embed if an error occurs', async () => {
      // Arrange
      embedManager.activeGameEmbed = undefined;
      // Act
      await embedManager.finishGame(gameInstance);
      // Assert
      expect(embedManager.activeGameEmbed).toBeUndefined();
      expect(postGameWinEmbedsSpy).toHaveBeenCalledTimes(1);
      verify(waitingRoomManager.sendToChannel(anything())).twice();
      expect(embedManager.waitingRoomEmbed).toBeUndefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
    });
  });
  describe('executeGameBoardMessage', () => {
    test('should send the game board message', async () => {
      // Arrange
      // Act
      await embedManager.executeGameBoardMessage(gameInstance, 'test');
      // Assert
      expect(embedManager.gameBoardMessage).toBeDefined();
    });
    test('should update the game board message', async () => {
      // Arrange
      embedManager.gameBoardMessage = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager.executeGameBoardMessage(gameInstance, 'test');
      // Assert
      expect(embedManager.gameBoardMessage).toBeDefined();
    });
  });
  describe('sendJoinWaitingRoomEmbed', () => {
    test('should reset the game state, reset the embed manager, and send the join waiting room embed', async () => {
      // Arrange
      // Act
      await embedManager.sendJoinWaitingRoomEmbed(gameInstance);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
      expect(game.state).toBeDefined();
      expect(gameState.reset).toHaveBeenCalledTimes(1);
    });
    test('should not send the join waiting room embed if the game is in maintenance', async () => {
      // Arrange
      when(mockMaintenanceService.isInMaintenance()).thenResolve(true);
      // Act
      await embedManager.sendJoinWaitingRoomEmbed(gameInstance);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
    });
  });
  describe('updateWaitingRoomEmbed', () => {
    test('should update the waiting room embed', async () => {
      // Arrange
      embedManager.waitingRoomEmbed = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager.updateWaitingRoomEmbed(gameInstance);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeDefined();
    });
    test('should not update the waiting room embed if an error occurs', async () => {
      // Arrange
      embedManager.waitingRoomEmbed = undefined;
      // Act
      await embedManager.updateWaitingRoomEmbed(gameInstance);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeUndefined();
    });
  });
});
