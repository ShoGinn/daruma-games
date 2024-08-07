import { mockAlgorand } from '../../../tests/mocks/mock-algorand-functions.js';
import {
  mockChannelSettings,
  mockedFakePlayerLongestGame,
  mockedFakePlayerPerfectGame,
} from '../../../tests/mocks/mock-functions.js';
import {
  playerRoundsDataIncrementingRolls,
  playerRoundsDataLongestGame,
  playerRoundsDataPerfectGame,
} from '../../../tests/mocks/mock-player-rounds-data.js';
import {
  EMOJI_RENDER_PHASE,
  gameNPCs,
  GameStatus,
  GameTypes,
} from '../../enums/daruma-training.js';
import * as algorand from '../../services/algorand.js';
import { ChannelTokenSettings } from '../../types/daruma-training.js';

import { GameState } from './dt-game-state.js';
import { Player } from './dt-player.js';

describe('GameState Class', () => {
  let gameState: GameState;
  let mockChannelTokenSettings: ChannelTokenSettings;
  let fakePlayer1: Player;
  let fakePlayer2: Player;
  const gameChannelSettings = mockChannelSettings(GameTypes.OneVsNpc);
  jest
    .spyOn(algorand, 'Algorand')
    .mockImplementation(() => mockAlgorand as unknown as algorand.Algorand);

  beforeEach(() => {
    gameState = new GameState(gameChannelSettings.token, undefined);
    mockChannelTokenSettings = {
      baseAmount: 1,
      roundModifier: 1,
      zenMultiplier: 1,
      zenRoundModifier: 1,
    } as ChannelTokenSettings;
    fakePlayer1 = mockedFakePlayerLongestGame();
    fakePlayer2 = mockedFakePlayerPerfectGame();
    gameState.playerManager.addPlayer(fakePlayer1);
    gameState.playerManager.addPlayer(fakePlayer2);
    gameState = gameState.setCurrentPlayer(fakePlayer1, 1);
  });
  describe('npc player init', () => {
    test('should create an npc game and reset npc', () => {
      const npcPlayer = gameNPCs[0];
      gameState = new GameState(gameChannelSettings.token, npcPlayer);
      gameState.playerManager.getAllPlayers()[0]!.roundsData = playerRoundsDataPerfectGame;
      gameState.playerManager.addPlayer(fakePlayer1);
      gameState.findZenAndWinners(mockChannelTokenSettings);
      expect(gameState.playerManager.getAllPlayers()).toHaveLength(2);
      expect(gameState.playerManager.getAllPlayers()[0]!.roundsData).toStrictEqual(
        playerRoundsDataPerfectGame,
      );
      expect(gameState.playerManager.getAllPlayers()[0]!.isWinner).toBeTruthy();
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(0);
      expect(gameState.gameRoundState.rollIndex).toBe(0);
      expect(gameState.gameRoundState.roundIndex).toBe(0);
      gameState = gameState.reset();
      expect(gameState.playerManager.getAllPlayers()).toHaveLength(1);
      expect(gameState.playerManager.getAllPlayers()[0]!.isWinner).toBeFalsy();
      expect(gameState.playerManager.getAllPlayers()[0]!.roundsData).not.toStrictEqual(
        playerRoundsDataPerfectGame,
      );
    });
  });
  describe('gamePlay', () => {
    test('should have a default game round state', () => {
      expect(gameState.playerManager.getAllPlayers()).toHaveLength(2);
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.rollIndex).toBe(0);
      expect(gameState.gameRoundState.roundIndex).toBe(0);
    });
    test('should increment the roll not the round and the game should not have a winner', () => {
      gameState = gameState.nextRoll();
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.rollIndex).toBe(1);
      expect(gameState.gameRoundState.roundIndex).toBe(0);
    });
    test('game is at roll 2 and incrementing the roll should increment the round and the game should not have a winner', () => {
      gameState = gameState.nextRoll();
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.rollIndex).toBe(1);
      expect(gameState.gameRoundState.roundIndex).toBe(0);
      gameState = gameState.nextRoll();
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.rollIndex).toBe(2);
      expect(gameState.gameRoundState.roundIndex).toBe(0);
      gameState = gameState.nextRoll();
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.rollIndex).toBe(0);
      expect(gameState.gameRoundState.roundIndex).toBe(1);
    });
    test('game is right before final roll and incrementing the roll should advance the round and the game should not have a winner', () => {
      for (let index = 0; index < 8; index++) {
        gameState = gameState.nextRoll();
      }
      gameState = gameState.nextRoll();
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.roundIndex).toBe(3);
      expect(gameState.gameRoundState.rollIndex).toBe(0);
    });
  });
  describe('reset', () => {
    test('should reset the game state', () => {
      const newGameState = gameState.reset();
      expect(newGameState).not.toBe(gameState);
    });
  });
  describe('maintenance', () => {
    test('should set the game into maintenance state', () => {
      const newGameState = gameState.maintenance();
      expect(newGameState.status).toEqual(GameStatus.maintenance);
    });
    test('should throw an error because the game is already in maintenance state', () => {
      const newGameState = gameState.maintenance();
      expect(() => newGameState.maintenance()).toThrow(
        `Can't set the game to maintenance from the current state`,
      );
      expect(newGameState.status).toEqual(GameStatus.maintenance);
    });
  });
  describe('canStartGame & startGame', () => {
    test('should return false because the game has not started', () => {
      expect(gameState.canStartGame(3)).toBeFalsy();
    });
    test('should return false because the game has started', () => {
      gameState = gameState.startGame(1);
      expect(gameState.canStartGame(1)).toBeFalsy();
    });
    test('cannot start game because the game is not in the proper state', () => {
      gameState = gameState.startGame(1);
      expect(gameState.canStartGame(1)).toBeFalsy();
      expect(() => gameState.startGame(1)).toThrow(`Can't start the game from the current state`);
      expect(gameState.status).toEqual(GameStatus.activeGame);
    });
    test('should return true because the game has not started and the game has enough players', () => {
      expect(gameState.canStartGame(1)).toBeTruthy();
    });
  });
  describe('finishGame', () => {
    test('should return false because the game has not started', () => {
      expect(() => gameState.finishGame()).toThrow(`Can't finish the game from the current state`);
      expect(gameState.status).toEqual(GameStatus.waitingRoom);
    });
    test('should return false because the game has started', () => {
      gameState = gameState.startGame(1);
      expect(() => gameState.finishGame()).toThrow(`Can't finish the game from the current state`);
      expect(gameState.status).toEqual(GameStatus.activeGame);
    });
    test('should return true because the game has finished and we have a winner', () => {
      gameState = gameState.startGame(1);
      gameState = gameState.updateStatus(GameStatus.win);
      gameState = gameState.finishGame();
      expect(gameState.status).toEqual(GameStatus.finished);
    });
  });
  describe('renderThisBoard', () => {
    test('should render the game board', () => {
      gameState.playerManager.getAllPlayers()[0]!.roundsData = playerRoundsDataLongestGame;
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      const gameBoard = gameState.renderThisBoard(EMOJI_RENDER_PHASE);
      expect(gameBoard).toContain(':one: :red_circle: :red_circle:');
      expect(gameBoard).toContain(':three: :red_circle: :red_circle:');
    });
  });
  describe('findZenAndWinners', () => {
    test('should find the zen and winners with game token settings', () => {
      gameState = gameState.findZenAndWinners(undefined, 1);
      expect(gameState.gameWinInfo.gameWinRollIndex).toBe(0);
      expect(gameState.gameWinInfo.gameWinRoundIndex).toBe(2);
      expect(gameState.gameWinInfo.payout).toBe(5);
      expect(gameState.gameWinInfo.zen).toBe(false);
    });

    test('should find the zen and winners', () => {
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      expect(gameState.gameWinInfo.gameWinRollIndex).toBe(0);
      expect(gameState.gameWinInfo.gameWinRoundIndex).toBe(2);
      expect(gameState.gameWinInfo.payout).toBe(1);
      expect(gameState.gameWinInfo.zen).toBe(false);
    });
    test('should set the game status to winner', () => {
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      for (let index = 0; index < 7; index++) {
        gameState = gameState.nextRoll();
      }
      const winner = gameState.checkForWin();
      expect(winner).toBeTruthy();
      expect(gameState.status).toEqual(GameStatus.win);
      expect(gameState.gameRoundState.playerIndex).toBe(1);
      expect(gameState.gameRoundState.rollIndex).toBe(0);
      expect(gameState.gameRoundState.roundIndex).toBe(2);
    });
    test('should set the game status to winner and then run next roll and the game is allready set', () => {
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      gameState = gameState.updateStatus(GameStatus.win);
      const winner = gameState.checkForWin();
      expect(winner).toBeTruthy();
      expect(gameState.status).toEqual(GameStatus.win);
    });
    test('winner should be player 1', () => {
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      expect(fakePlayer2.isWinner).toBeTruthy();
    });
    test('change bot to have incrementing game, same round different roll', () => {
      gameState.playerManager.getAllPlayers()[0]!.roundsData = playerRoundsDataIncrementingRolls;
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      expect(gameState.gameWinInfo.gameWinRollIndex).toBe(0);
      expect(gameState.gameWinInfo.gameWinRoundIndex).toBe(2);
      expect(gameState.gameWinInfo.payout).toBe(1);
      expect(gameState.gameWinInfo.zen).toBe(false);
      expect(fakePlayer2.isWinner).toBeTruthy();
    });
    test('change bot to have same game as player to have zen', () => {
      gameState.playerManager.getAllPlayers()[0]!.roundsData = playerRoundsDataPerfectGame;
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings);
      expect(gameState.gameWinInfo.gameWinRollIndex).toBe(0);
      expect(gameState.gameWinInfo.gameWinRoundIndex).toBe(2);
      expect(gameState.gameWinInfo.payout).toBe(1);
      expect(gameState.gameWinInfo.zen).toBe(true);
      expect(fakePlayer2.isWinner).toBeTruthy();
      expect(gameState.playerManager.getAllPlayers()[0]!.isWinner).toBeTruthy();
    });
    test('should find the zen and winners with a modifier', () => {
      gameState = gameState.findZenAndWinners(mockChannelTokenSettings, 2);
      expect(gameState.gameWinInfo.gameWinRollIndex).toBe(0);
      expect(gameState.gameWinInfo.gameWinRoundIndex).toBe(2);
      expect(gameState.gameWinInfo.payout).toBe(2);
      expect(gameState.gameWinInfo.zen).toBe(false);
    });
    test('if number of players is 0 then it throws an error', () => {
      gameState.playerManager.removePlayer(fakePlayer1.dbUser._id);
      gameState.playerManager.removePlayer(fakePlayer2.dbUser._id);
      expect(() => gameState.findZenAndWinners(mockChannelTokenSettings)).toThrow(
        `Can't find zen and winners with no players`,
      );
    });
  });
});
