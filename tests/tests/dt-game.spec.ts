/* eslint-disable @typescript-eslint/unbound-method */
import { anything, instance, mock, verify, when } from 'ts-mockito';

import { GameStatus, GameTypes } from '../../src/enums/daruma-training.js';
import { BoostService } from '../../src/services/boost-payout.js';
import { DarumaTrainingEncountersService } from '../../src/services/dt-encounters.js';
import { EmbedManager } from '../../src/utils/classes/dt-embedmanager.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { WaitingRoomManager } from '../../src/utils/classes/dt-waitingroommanager.js';
import { defaultGameRoundState, defaultGameWinInfo } from '../../src/utils/functions/dt-utils.js';
import { mockChannelSettings, mockedFakePlayerPerfectGame } from '../utils/fake-mocks.js';

jest.mock('../../src/services/dt-encounters.js', () => ({
  createEncounter: jest.fn().mockResolvedValue(1),
}));
jest.mock('../../src/services/boost-payout.js', () => ({
  getTemporaryPayoutModifier: jest.fn().mockResolvedValue(1),
}));
describe('The Game Class', () => {
  let oneVsNpc: Game;
  let oneVsOne: Game;
  let newPlayer: Player;
  let mockWaitingRoomManager: WaitingRoomManager;
  let mockedWaitingRoomManager: WaitingRoomManager;
  let mockEmbedManager: EmbedManager;
  let mockedEmbedManager: EmbedManager;
  let mockBoostService: BoostService;
  let mockedBoostService: BoostService;
  let mockDarumaTrainingEncountersService: DarumaTrainingEncountersService;
  let mockedDarumaTrainingEncountersService: DarumaTrainingEncountersService;
  const oneVsNpcSettings = mockChannelSettings(GameTypes.OneVsNpc);
  const oneVsOneSettings = mockChannelSettings(GameTypes.OneVsOne);

  beforeEach(async () => {
    mockEmbedManager = mock(EmbedManager);
    mockedEmbedManager = instance(mockEmbedManager);
    mockWaitingRoomManager = mock(WaitingRoomManager);
    mockedWaitingRoomManager = instance(mockWaitingRoomManager);
    mockBoostService = mock(BoostService);
    mockedBoostService = instance(mockBoostService);
    mockDarumaTrainingEncountersService = mock(DarumaTrainingEncountersService);
    mockedDarumaTrainingEncountersService = instance(mockDarumaTrainingEncountersService);

    oneVsNpc = new Game(
      mockedWaitingRoomManager,
      mockedEmbedManager,
      mockedBoostService,
      mockedDarumaTrainingEncountersService,
    );
    oneVsOne = new Game(
      mockedWaitingRoomManager,
      mockedEmbedManager,
      mockedBoostService,
      mockedDarumaTrainingEncountersService,
    );

    newPlayer = mockedFakePlayerPerfectGame();
    await oneVsNpc.initialize(oneVsNpcSettings);
    await oneVsOne.initialize(oneVsOneSettings);
  });
  describe('Class creation items', () => {
    test('initialize', async () => {
      await expect(oneVsNpc['initialize']).resolves.toBeUndefined();
      verify(mockWaitingRoomManager.initialize(anything())).once();
    });
    test('should have an NPC for OneVsNpc', () => {
      // expect(oneVsNpc.NPC).toBeDefined();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState).toEqual({ ...defaultGameRoundState });
      expect(oneVsNpc.state.gameWinInfo).toEqual({ ...defaultGameWinInfo });
      expect(oneVsNpc.state.playerManager.getAllPlayers()).toHaveLength(1);
      expect(oneVsNpc.state.encounterId).toBeUndefined();
    });
    test('should not have an npc due to an error', () => {
      // expect(oneVsNpc.NPC).toBeUndefined();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState).toEqual({ ...defaultGameRoundState });
      expect(oneVsNpc.state.gameWinInfo).toEqual({ ...defaultGameWinInfo });
      expect(oneVsNpc.state.playerManager.getAllPlayers()).toHaveLength(0);
      expect(oneVsNpc.state.encounterId).toBeUndefined();
    });

    test('should not have an NPC for OneVsOne', () => {
      // expect(oneVsOne.NPC).toBeUndefined();
      expect(oneVsOne.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsOne.state.gameRoundState).toEqual({ ...defaultGameRoundState });
      expect(oneVsOne.state.gameWinInfo).toEqual({ ...defaultGameWinInfo });
      expect(oneVsOne.state.playerManager.getAllPlayers()).toHaveLength(0);
      expect(oneVsOne.state.encounterId).toBeUndefined();
    });

    // test('should be able to set a game setting and game status', () => {
    //   expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
    //   let channelSettings = oneVsNpc.settings;
    //   channelSettings = { ...channelSettings, channelId: '321' };
    //   oneVsNpc.settings = channelSettings;
    //   oneVsNpc.state = oneVsNpc.state.startGame(1);
    //   expect(oneVsNpc.settings.channelId).toBe('321');
    //   expect(oneVsNpc.state.status).toEqual(GameStatus.activeGame);
    // });
  });
  describe('check add and remove players', () => {
    test('should add a player', async () => {
      const playerAdded = await oneVsNpc.addPlayer(newPlayer);
      expect(playerAdded).toBeTruthy();
      expect(oneVsNpc.state.playerManager.getAllPlayers()).toHaveLength(2);
      verify(mockEmbedManager.updateWaitingRoomEmbed(oneVsNpc)).once();
    });
    test('should remove a player', async () => {
      const playerRemoved = await oneVsNpc.removePlayer(newPlayer.dbUser.id);
      expect(playerRemoved).toBeFalsy();
      expect(oneVsNpc.state.playerManager.getAllPlayers()).toHaveLength(1);
      verify(mockEmbedManager.updateWaitingRoomEmbed(oneVsNpc)).once();
    });
  });
  describe('add a player and execute', () => {
    beforeEach(() => {
      oneVsNpc.state.playerManager.addPlayer(newPlayer);
      oneVsNpc.updateState(oneVsNpc.state.setCurrentPlayer(newPlayer, 1));
    });

    describe('save the encounter and update the players', () => {
      test('should save the encounter and update the players', async () => {
        // expect(oneVsNpc.NPC).toBeDefined();
        await oneVsNpc['saveEncounter']();
        expect(newPlayer.isWinner).toBeTruthy();
        // expect(oneVsNpc.NPC.isWinner).toBeFalsy();
      });
    });
    describe('startChannelGame', () => {
      test('check that it calls the correct functions', async () => {
        const mockedHandleGameLogic = jest.fn();
        const mockedStartGame = jest.fn();
        const mockedFinishGame = jest.fn();
        oneVsNpc['handleGameLogic'] = mockedHandleGameLogic;
        oneVsNpc['startGame'] = mockedStartGame;
        oneVsNpc['finishGame'] = mockedFinishGame;
        await oneVsNpc.startChannelGame();
        expect(mockedStartGame).toHaveBeenCalledTimes(1);
        expect(mockedHandleGameLogic).toHaveBeenCalledTimes(1);
        expect(mockedFinishGame).toHaveBeenCalledTimes(1);
      });
    });
    describe('start the game', () => {
      test('should start the game', async () => {
        await oneVsNpc['startGame']();
        expect(oneVsNpc.state.status).toEqual(GameStatus.activeGame);
        expect(oneVsNpc.state.encounterId).toBe(1);
        verify(mockEmbedManager.startGame(oneVsNpc)).once();
      });
      test('should not start the game', async () => {
        oneVsNpc.updateState(oneVsNpc.state.updateStatus(GameStatus.finished));
        await expect(oneVsNpc['startGame']()).rejects.toThrow(
          `Can't start the game from the current state`,
        );
      });
    });
    describe('finish the game', () => {
      test('should finish the game', async () => {
        await oneVsNpc['finishGame']();
        verify(mockEmbedManager.finishGame(oneVsNpc)).once();
      });
    });
    describe('game handler', () => {
      // test('should use the default phase delay but no players', async () => {
      //   const testGame = new Game(oneVsNpcSettings);
      //   await testGame['handleGameLogic']();
      //   expect(testGame.state.status).toEqual(GameStatus.waitingRoom);
      //   verify(mockWaitingRoomManager.sendToChannel(anything())).never();
      // });
      test('should handle the game in a normal sense', async () => {
        await oneVsNpc['startGame']();
        const mockedPhaseDelay = jest.fn().mockResolvedValue([1, 1]);
        await oneVsNpc['handleGameLogic'](mockedPhaseDelay);
        expect(oneVsNpc.state.status).toEqual(GameStatus.win);
      });
      test('should handle the game when the message is wrong', async () => {
        when(mockEmbedManager.executeGameBoardMessage(oneVsNpc, anything())).thenReject(
          new Error('error'),
        );
        await oneVsNpc['startGame']();
        const mockedPhaseDelay = jest.fn().mockResolvedValue([1, 1]);
        await oneVsNpc['handleGameLogic'](mockedPhaseDelay);
        expect(oneVsNpc.state.status).toEqual(GameStatus.win);
      });
    });
  });
});
