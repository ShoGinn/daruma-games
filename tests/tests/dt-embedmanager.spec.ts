/* eslint-disable @typescript-eslint/unbound-method */
import { Message } from 'discord.js';
import { anything, instance, mock, verify, when } from 'ts-mockito';

// import { DarumaTrainingGameRepository } from '../../src/repositories/dt-game-repository.js';
import { GameStatus } from '../../src/enums/daruma-training.js';
import { EmbedManager } from '../../src/utils/classes/dt-embedmanager.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { WaitingRoomManager } from '../../src/utils/classes/dt-waitingroommanager.js';
import { doEmbed, postGameWinEmbeds } from '../../src/utils/functions/dt-embeds.js';
import { isInMaintenance } from '../../src/utils/functions/maintenance.js';

const isInMaintenanceMock = isInMaintenance as jest.MockedFunction<typeof isInMaintenance>;
jest.mock('../../src/utils/functions/maintenance.js', () => ({
  isInMaintenance: jest.fn(),
}));
jest.mock('../../src/utils/functions/dt-embeds.js', () => ({
  doEmbed: jest.fn(),
  postGameWinEmbeds: jest.fn(),
}));
describe('EmbedManager', () => {
  let embedManager: EmbedManager;
  let game: Game;
  let mockedGame: Game;
  let waitingRoomManager: WaitingRoomManager;
  let mockedWaitingRoomManager: WaitingRoomManager;

  beforeEach(() => {
    // Arrange
    embedManager = new EmbedManager();
    game = mock(Game);
    mockedGame = instance(game);
    waitingRoomManager = mock(WaitingRoomManager);
    mockedWaitingRoomManager = instance(waitingRoomManager);
    when(game.waitingRoomManager).thenReturn(mockedWaitingRoomManager);
    when(waitingRoomManager.sendToChannel(anything())).thenResolve({} as unknown as Message);
    mockedGame.settings = { maxCapacity: 1 } as unknown as Game['settings'];
    mockedGame.state = {
      status: GameStatus.waitingRoom,
      finishGame: jest.fn(),
      maintenance: jest.fn(),
      reset: jest.fn(),
      canStartGame: jest.fn().mockReturnValue(true),
    } as unknown as Game['state'];
    mockedGame.state.finishGame = jest
      .fn()
      .mockReturnValue({ ...mockedGame.state, status: GameStatus.win });
    mockedGame.state.reset = jest
      .fn()
      .mockReturnValue({ ...mockedGame.state, status: GameStatus.waitingRoom });
    mockedGame.state.maintenance = jest
      .fn()
      .mockReturnValue({ ...mockedGame.state, status: GameStatus.maintenance });
  });
  afterEach(() => {
    jest.clearAllMocks();
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
      const result = await embedManager['sendEmbed'](mockedGame);
      // Assert
      expect(result).toBeDefined();
      verify(waitingRoomManager.sendToChannel(anything())).once();
      expect(doEmbed).toHaveBeenCalledTimes(1);
    });
  });
  describe('updateMessage', () => {
    test('should update the message', async () => {
      // Arrange
      const message = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager['updateMessage'](mockedGame, message);
      // Assert
      expect(message.edit).toHaveBeenCalledTimes(1);
      expect(doEmbed).toHaveBeenCalledTimes(1);
    });
    test('should not update the message if an error occurs', async () => {
      // Arrange
      const message = { edit: jest.fn(() => Promise.reject()) } as unknown as Message;
      // Act
      await embedManager['updateMessage'](mockedGame, message);
      // Assert
      expect(message.edit).toHaveBeenCalledTimes(1);
      expect(doEmbed).toHaveBeenCalledTimes(1);
    });
  });
  describe('sendWinEmbeds', () => {
    test('should send the win embeds', async () => {
      // Arrange
      // Act
      await embedManager['sendWinEmbeds'](mockedGame);
      // Assert
      verify(waitingRoomManager.sendToChannel(anything())).once();
      expect(postGameWinEmbeds).toHaveBeenCalledTimes(1);
    });
  });
  describe('startGame', () => {
    test('should delete the waiting room message and send the game embed', async () => {
      // Arrange
      // Act
      await embedManager.startGame(mockedGame);
      // Assert
      expect(embedManager.activeGameEmbed).toBeDefined();
    });
  });
  describe('finishGame', () => {
    test('should send the win embeds, update the game embed, and send the join waiting room embed', async () => {
      // Arrange
      embedManager.activeGameEmbed = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager.finishGame(mockedGame);
      // Assert
      expect(embedManager.activeGameEmbed).toBeUndefined();
      expect(postGameWinEmbeds).toHaveBeenCalledTimes(1);
      verify(waitingRoomManager.sendToChannel(anything())).twice();
      expect(isInMaintenanceMock).toHaveBeenCalledTimes(1);
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
    });
    test('should not update the game embed if an error occurs', async () => {
      // Arrange
      embedManager.activeGameEmbed = undefined;
      // Act
      await embedManager.finishGame(mockedGame);
      // Assert
      expect(embedManager.activeGameEmbed).toBeUndefined();
      expect(postGameWinEmbeds).toHaveBeenCalledTimes(1);
      verify(waitingRoomManager.sendToChannel(anything())).once();
      expect(isInMaintenanceMock).toHaveBeenCalledTimes(0);
      expect(embedManager.waitingRoomEmbed).toBeUndefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
    });
  });
  describe('executeGameBoardMessage', () => {
    test('should send the game board message', async () => {
      // Arrange
      // Act
      await embedManager.executeGameBoardMessage(mockedGame, 'test');
      // Assert
      expect(embedManager.gameBoardMessage).toBeDefined();
    });
    test('should update the game board message', async () => {
      // Arrange
      embedManager.gameBoardMessage = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager.executeGameBoardMessage(mockedGame, 'test');
      // Assert
      expect(embedManager.gameBoardMessage).toBeDefined();
    });
  });
  describe('sendJoinWaitingRoomEmbed', () => {
    test('should reset the game state, reset the embed manager, and send the join waiting room embed', async () => {
      // Arrange
      // Act
      await embedManager.sendJoinWaitingRoomEmbed(mockedGame);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
      expect(mockedGame.state).toBeDefined();
      expect(mockedGame.state.status).toEqual(GameStatus.waitingRoom);
      expect(isInMaintenanceMock).toHaveBeenCalledTimes(1);
    });
    test('should not send the join waiting room embed if the game is in maintenance', async () => {
      // Arrange
      isInMaintenanceMock.mockResolvedValue(true);
      // Act
      await embedManager.sendJoinWaitingRoomEmbed(mockedGame);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeDefined();
      expect(embedManager.gameBoardMessage).toBeUndefined();
      expect(isInMaintenanceMock).toHaveBeenCalledTimes(1);
    });
  });
  describe('updateWaitingRoomEmbed', () => {
    test('should update the waiting room embed', async () => {
      // Arrange
      embedManager.waitingRoomEmbed = { edit: jest.fn() } as unknown as Message;
      // Act
      await embedManager.updateWaitingRoomEmbed(mockedGame);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeDefined();
    });
    test('should not update the waiting room embed if an error occurs', async () => {
      // Arrange
      embedManager.waitingRoomEmbed = undefined;
      // Act
      await embedManager.updateWaitingRoomEmbed(mockedGame);
      // Assert
      expect(embedManager.waitingRoomEmbed).toBeUndefined();
    });
  });
});
