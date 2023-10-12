import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { AlgoNFTAsset } from '../../src/entities/algo-nft-asset.entity.js';
import { AlgoWallet } from '../../src/entities/algo-wallet.entity.js';
import { DtEncounters } from '../../src/entities/dt-encounters.entity.js';
import { EMOJI_RENDER_PHASE, GameStatus, GameTypes } from '../../src/enums/daruma-training.js';
import { GameAssets } from '../../src/model/logic/game-assets.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { defaultGameRoundState, defaultGameWinInfo } from '../../src/utils/functions/dt-utils.js';
import {
  playerRoundsDataIncrementingRolls,
  playerRoundsDataLongestGame,
  playerRoundsDataPerfectGame,
} from '../mocks/mock-player-rounds-data.js';
import { initORM } from '../utils/bootstrap.js';
import {
  addRandomAssetAndWalletToUser,
  createRandomASA,
  createRandomGame,
  createRandomPlayer,
} from '../utils/test-funcs.js';
jest.mock('../../src/services/algorand.js', () => ({
  Algorand: jest.fn().mockImplementation(() => ({
    // returns a mock random wallet
    getCreatedAssets: jest.fn().mockReturnValue([]),
    updateAssetMetadata: jest.fn().mockReturnValue(0),
    generateWalletAccount: jest.fn().mockReturnValue(Math.random().toString(36).slice(7)),
    getAllStdAssets: jest.fn().mockReturnValue([]),
    getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: false, tokens: 10 }),
    lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
  })),
}));
describe('The Game Class', () => {
  let orm: MikroORM;
  let database: EntityManager;
  let client: Client;
  let oneVsNpc: Game;
  let oneVsOne: Game;
  let fourVsNpc: Game;
  let newPlayer;
  beforeAll(async () => {
    orm = await initORM();
    database = orm.em.fork();
    client = container.resolve(Client);
    await createRandomASA(database, 'KRMA', 'KRMA');
    const gameAssets = container.resolve(GameAssets);
    await gameAssets.initAll();
    oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
    oneVsOne = await createRandomGame(database, client, GameTypes.OneVsOne);
    fourVsNpc = await createRandomGame(database, client, GameTypes.FourVsNpc);
    newPlayer = await createRandomPlayer(database);
  });
  afterAll(async () => {
    await orm.close(true);
  });
  afterEach(() => {
    oneVsNpc.state = oneVsNpc.state.reset();
    oneVsOne.state = oneVsOne.state.reset();
    fourVsNpc.state = fourVsNpc.state.reset();
  });
  // afterEach(async () => {
  //   await orm.schema.clearDatabase();
  // });
  describe('Class creation items', () => {
    test('should return false if the game has not started', () => {
      expect(oneVsNpc.getNPC).toEqual({
        assetIndex: 1,
        gameType: 'OneVsNpc',
        name: 'Karasu',
      });
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState).toEqual({ ...defaultGameRoundState });
      expect(oneVsNpc.state.gameWinInfo).toEqual({ ...defaultGameWinInfo });
      expect(oneVsNpc.state.players).toHaveLength(0);
      expect(oneVsNpc.embed).toBeUndefined();
      expect(oneVsNpc.waitingRoomChannel).toBeNull();
      expect(oneVsNpc.state.encounterId).toBeNull();
    });
    test('should be able to set a game setting and game status', () => {
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      const channelSettings = oneVsNpc.settings;
      channelSettings.channelId = '321';
      oneVsNpc.settings = channelSettings;
      oneVsNpc.state = oneVsNpc.state.startGame(1);
      expect(oneVsNpc.settings.channelId).toEqual('321');
      expect(oneVsNpc.state.status).toEqual(GameStatus.activeGame);
    });
  });
  describe('Add an NPC to the game', () => {
    test('should not add the NPC because the asset is not created', async () => {
      const addedNPc = await oneVsNpc.addNpc();
      expect(addedNPc).toBeFalsy();
    });
    test('should not add the NPC because the game type does not support NPC', async () => {
      await database.getRepository(AlgoWallet).createNPCsIfNotExists();
      const addedNPc = await oneVsOne.addNpc();
      expect(addedNPc).toBeFalsy();
    });
    test('should be able to add the NPC to the game', async () => {
      await database.getRepository(AlgoWallet).createNPCsIfNotExists();
      const addedNPc = await oneVsNpc.addNpc();
      expect(addedNPc).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
    });
  });
  describe('Add a player to the game', () => {
    test('should add a player to the game', () => {
      expect(oneVsNpc.state.players).toHaveLength(0);
      const addedPlayer = oneVsNpc.state.addPlayer(newPlayer.player);
      expect(addedPlayer).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      expect(oneVsNpc.state.getPlayer(newPlayer.databasePlayer.user.id)).toEqual(newPlayer.player);
      expect(oneVsNpc.state.getPlayerIndex(newPlayer.databasePlayer.user.id)).toEqual(0);
    });
    test('should not add a player or change the asset to the game because the player is in the game and the asset is the same', async () => {
      const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);

      const addedPlayer = oneVsNpc.state.addPlayer(newPlayer.player);
      const addedPlayerAsset = newPlayer.player.playableNFT;
      expect(addedPlayer).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      expect(oneVsNpc.state.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
        addedPlayerAsset,
      );
      const tryAddingAgain = oneVsNpc.state.addPlayer(newPlayer.player);
      expect(tryAddingAgain).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      expect(oneVsNpc.state.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
        addedPlayerAsset,
      );
    });
    test('should not add a new player but change the asset to the game because the player is in the game and the asset is different', async () => {
      const addedPlayer = oneVsNpc.state.addPlayer(newPlayer.player);
      const addedPlayerAsset = newPlayer.player.playableNFT;
      expect(addedPlayer).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      expect(oneVsNpc.state.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
        addedPlayerAsset,
      );
      const newAsset = await addRandomAssetAndWalletToUser(database, newPlayer.databasePlayer.user);
      const playerWithNewAsset = new Player(newPlayer.databasePlayer.user, newAsset.asset);
      const tryAddingAgain = oneVsNpc.state.addPlayer(playerWithNewAsset);
      expect(tryAddingAgain).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      expect(oneVsNpc.state.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
        newAsset.asset,
      );
    });
  });
  describe('Remove player from the game', () => {
    test('should remove a player from the game', () => {
      const addedPlayer = oneVsNpc.state.addPlayer(newPlayer.player);
      expect(addedPlayer).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      const removedPlayer = oneVsNpc.state.removePlayer(newPlayer.databasePlayer.user.id);
      expect(removedPlayer).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(0);
    });
    test('should not remove a player from the game because the player is not in the game', () => {
      const addedPlayer = oneVsNpc.state.addPlayer(newPlayer.player);
      expect(addedPlayer).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(1);
      const removedPlayer = oneVsNpc.state.removePlayer('fakeId');
      expect(removedPlayer).toBeFalsy();
      expect(oneVsNpc.state.players).toHaveLength(1);
    });
    test('should remove all players from the game', async () => {
      const newPlayer2 = await createRandomPlayer(database);
      const addedPlayer = oneVsNpc.state.addPlayer(newPlayer.player);
      const addedPlayer2 = oneVsNpc.state.addPlayer(newPlayer2.player);
      expect(addedPlayer).toBeTruthy();
      expect(addedPlayer2).toBeTruthy();
      expect(oneVsNpc.state.players).toHaveLength(2);
      oneVsNpc.state = oneVsNpc.state.reset();
      expect(oneVsNpc.state.players).toHaveLength(0);
    });
  });
  describe('Rolls and Rounds Winners', () => {
    let oneVsNpc: Game;
    let player: Player;
    beforeEach(async () => {
      await database.getRepository(AlgoWallet).createNPCsIfNotExists();
      oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
      await oneVsNpc.addNpc();
      // set the bot to the longest game
      oneVsNpc.state.players[0].roundsData = playerRoundsDataLongestGame;

      player = newPlayer.player;
      // change player to have a fastest win game
      player.roundsData = playerRoundsDataPerfectGame;
      oneVsNpc.state.addPlayer(player);
      oneVsNpc.state.setCurrentPlayer(player, 1);
    });
    test('should have a default game round state', () => {
      expect(oneVsNpc.state.players).toHaveLength(2);
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(0);
      expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(0);
    });
    test('should increment the roll not the round and the game should not have a winner', () => {
      oneVsNpc.state = oneVsNpc.state.nextRoll();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(0);
    });
    test('game is at roll 2 and incrementing the roll should increment the round and the game should not have a winner', () => {
      oneVsNpc.state = oneVsNpc.state.nextRoll();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(0);
      oneVsNpc.state = oneVsNpc.state.nextRoll();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(2);
      expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(0);
      oneVsNpc.state = oneVsNpc.state.nextRoll();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(0);
      expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(1);
    });
    test('game is right before final roll and incrementing the roll should advance the round and the game should not have a winner', () => {
      oneVsNpc.state.gameRoundState.rollIndex = 2;
      oneVsNpc.state.gameRoundState.roundIndex = 2;
      oneVsNpc.state = oneVsNpc.state.nextRoll();
      expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
      expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
      expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(0);
      expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(3);
    });
    describe('add processing of winners with findZenAndWinners', () => {
      test('should find the zen and winners', () => {
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        expect(oneVsNpc.state.gameWinInfo.gameWinRollIndex).toEqual(0);
        expect(oneVsNpc.state.gameWinInfo.gameWinRoundIndex).toEqual(2);
        expect(oneVsNpc.state.gameWinInfo.payout).toEqual(5);
        expect(oneVsNpc.state.gameWinInfo.zen).toEqual(false);
      });
      test('should set the game status to winner', () => {
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        for (let index = 0; index < 7; index++) {
          oneVsNpc.state = oneVsNpc.state.nextRoll();
        }
        expect(oneVsNpc.state.status).toEqual(GameStatus.win);
        expect(oneVsNpc.state.gameRoundState.playerIndex).toEqual(1);
        expect(oneVsNpc.state.gameRoundState.rollIndex).toEqual(0);
        expect(oneVsNpc.state.gameRoundState.roundIndex).toEqual(2);
      });
      test('winner should be player 1', () => {
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        expect(player.isWinner).toBeTruthy();
      });
      test('change bot to have incrementing game, same round different roll', () => {
        oneVsNpc.state.players[0].roundsData = playerRoundsDataIncrementingRolls;
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        expect(oneVsNpc.state.gameWinInfo.gameWinRollIndex).toEqual(0);
        expect(oneVsNpc.state.gameWinInfo.gameWinRoundIndex).toEqual(2);
        expect(oneVsNpc.state.gameWinInfo.payout).toEqual(5);
        expect(oneVsNpc.state.gameWinInfo.zen).toEqual(false);
        expect(player.isWinner).toBeTruthy();
      });
      test('change bot to have same game as player to have zen', () => {
        oneVsNpc.state.players[0].roundsData = playerRoundsDataPerfectGame;
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        expect(oneVsNpc.state.gameWinInfo.gameWinRollIndex).toEqual(0);
        expect(oneVsNpc.state.gameWinInfo.gameWinRoundIndex).toEqual(2);
        expect(oneVsNpc.state.gameWinInfo.payout).toEqual(5);
        expect(oneVsNpc.state.gameWinInfo.zen).toEqual(true);
        expect(player.isWinner).toBeTruthy();
        expect(oneVsNpc.state.players[0].isWinner).toBeTruthy();
      });
      test('should find the zen and winners with a modifier', () => {
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token, 2);
        expect(oneVsNpc.state.gameWinInfo.gameWinRollIndex).toEqual(0);
        expect(oneVsNpc.state.gameWinInfo.gameWinRoundIndex).toEqual(2);
        expect(oneVsNpc.state.gameWinInfo.payout).toEqual(10);
        expect(oneVsNpc.state.gameWinInfo.zen).toEqual(false);
      });
    });
    describe('save the encounter and update the players', () => {
      test('should save the encounter and update the players', async () => {
        oneVsNpc.state.players[0].roundsData = playerRoundsDataLongestGame;
        await oneVsNpc.saveEncounter();
        const encounters = await database.getRepository(DtEncounters).findAll();
        expect(encounters).toHaveLength(1);
        expect(player.isWinner).toBeTruthy();
        expect(oneVsNpc.state.players[0].isWinner).toBeFalsy();
        const newDatabaseFork = orm.em.fork();
        const assetStats = await newDatabaseFork
          .getRepository(AlgoNFTAsset)
          .findOneOrFail({ id: player.playableNFT.id });
        expect(assetStats.dojoWins).toEqual(1);
        expect(assetStats.dojoLosses).toEqual(0);
        expect(assetStats.dojoZen).toEqual(0);
        const timeNow = new Date();
        expect(assetStats.dojoCoolDown.getTime()).toBeGreaterThan(timeNow.getTime());
      });
    });
    describe('play the game, then reset the board', () => {
      test('should play a game and update the players then reset the game state', () => {
        oneVsNpc.state.players[0].roundsData = playerRoundsDataLongestGame;
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        expect(oneVsNpc.state.gameRoundState.currentPlayer).toEqual(player);
        expect(oneVsNpc.state.gameWinInfo.gameWinRoundIndex).toEqual(2);
        oneVsNpc.state = oneVsNpc.state.reset();
        expect(oneVsNpc.state.gameRoundState.currentPlayer).toBeUndefined();
        expect(oneVsNpc.state.gameWinInfo.gameWinRoundIndex).toEqual(Number.MAX_SAFE_INTEGER);
      });
    });
    describe('render the game board', () => {
      test('should render the game board', () => {
        oneVsNpc.state.players[0].roundsData = playerRoundsDataLongestGame;
        oneVsNpc.state.findZenAndWinners(oneVsNpc.settings.token);
        const gameBoard = oneVsNpc.state.renderThisBoard(EMOJI_RENDER_PHASE);
        expect(gameBoard).toContain(':one: 🔴 🔴');
        expect(gameBoard).toContain(':three: 🔴 🔴');
      });
    });
  });
  describe('The Game Mechanics', () => {
    describe('Check to see if the game can start', () => {
      test('should return false because the game has not started', () => {
        expect(oneVsNpc.state.canStartGame(1)).toBeFalsy();
      });
      test('should return false because the game has started', () => {
        oneVsNpc.state.addPlayer(newPlayer.player);
        oneVsNpc.state = oneVsNpc.state.startGame(1);
        expect(oneVsNpc.state.canStartGame(1)).toBeFalsy();
      });
      test('cannot start game because the game is not in the proper state', () => {
        oneVsNpc.state = oneVsNpc.state.startGame(1);
        expect(oneVsNpc.state.canStartGame(1)).toBeFalsy();
        try {
          oneVsNpc.state = oneVsNpc.state.startGame(1);
        } catch (error) {
          expect(error).toEqual(new Error(`Can't start the game from the current state`));
          expect(oneVsNpc.state.status).toEqual(GameStatus.activeGame);
        }
      });
      test('should return true because the game has not started and the game has enough players', () => {
        oneVsNpc.state.addPlayer(newPlayer.player);
        expect(oneVsNpc.state.canStartGame(1)).toBeTruthy();
      });
    });
    describe('Check if the game can finish', () => {
      test('should return false because the game has not started', () => {
        try {
          oneVsNpc.state = oneVsNpc.state.finishGame();
        } catch (error) {
          expect(error).toEqual(new Error(`Can't finish the game from the current state`));
          expect(oneVsNpc.state.status).toEqual(GameStatus.waitingRoom);
        }
      });
      test('should return false because the game has started', () => {
        oneVsNpc.state.addPlayer(newPlayer.player);
        oneVsNpc.state = oneVsNpc.state.startGame(1);
        try {
          oneVsNpc.state = oneVsNpc.state.finishGame();
        } catch (error) {
          expect(error).toEqual(new Error(`Can't finish the game from the current state`));
          expect(oneVsNpc.state.status).toEqual(GameStatus.activeGame);
        }
      });
      test('should return true because the game has finished and we have a winner', () => {
        oneVsNpc.state.addPlayer(newPlayer.player);
        oneVsNpc.state = oneVsNpc.state.startGame(1);
        oneVsNpc.state = oneVsNpc.state.updateStatus(GameStatus.win);
        oneVsNpc.state = oneVsNpc.state.finishGame();
        expect(oneVsNpc.state.status).toEqual(GameStatus.finished);
      });
    });
  });
});
