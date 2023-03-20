import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { AlgoWallet } from '../../src/entities/algo-wallet.entity.js';
import { GameStatus, GameTypes } from '../../src/enums/daruma-training.js';
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
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(() => {
        database = orm.em.fork();
        client = container.resolve(Client);
    });
    afterEach(async () => {
        await orm.schema.clearDatabase();
    });
    describe('Class creation items', () => {
        it('should return false if the game has not started', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            expect(oneVsNpc.getNPC).toEqual({
                assetIndex: 1,
                gameType: 'OneVsNpc',
                name: 'Karasu',
            });
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState).toEqual({ ...defaultGameRoundState });
            expect(oneVsNpc.gameWinInfo).toEqual({ ...defaultGameWinInfo });
            expect(oneVsNpc.players).toHaveLength(0);
            expect(oneVsNpc.embed).toBeUndefined();
            expect(oneVsNpc.waitingRoomChannel).toBeNull();
            expect(oneVsNpc.encounterId).toBeNull();
        });
        it('should be able to set a game setting and game status', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.settings.channelId).toEqual('channel-id');
            const channelSettings = oneVsNpc.settings;
            channelSettings.channelId = '321';
            oneVsNpc.settings = channelSettings;
            oneVsNpc.status = GameStatus.finished;
            expect(oneVsNpc.settings.channelId).toEqual('321');
            expect(oneVsNpc.status).toEqual(GameStatus.finished);
        });
    });
    describe('Add an NPC to the game', () => {
        it('should not add the NPC because the asset is not created', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const addedNPc = await oneVsNpc.addNpc();
            expect(addedNPc).toBeFalsy();
        });
        it('should not add the NPC because the game type does not support NPC', async () => {
            await database.getRepository(AlgoWallet).createNPCsIfNotExists();
            const oneVsOne = await createRandomGame(database, client, GameTypes.OneVsOne);
            const addedNPc = await oneVsOne.addNpc();
            expect(addedNPc).toBeFalsy();
        });
        it('should be able to add the NPC to the game', async () => {
            await database.getRepository(AlgoWallet).createNPCsIfNotExists();
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const addedNPc = await oneVsNpc.addNpc();
            expect(addedNPc).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
        });
    });
    describe('Add a player to the game', () => {
        it('should add a player to the game', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const newPlayer = await createRandomPlayer(database);
            const addedPlayer = oneVsNpc.addPlayer(newPlayer.player);
            expect(addedPlayer).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            expect(oneVsNpc.getPlayer(newPlayer.databasePlayer.user.id)).toEqual(newPlayer.player);
            expect(oneVsNpc.getPlayerIndex(newPlayer.databasePlayer.user.id)).toEqual(0);
        });
        it('should not add a player or change the asset to the game because the player is in the game and the asset is the same', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const newPlayer = await createRandomPlayer(database);
            const addedPlayer = oneVsNpc.addPlayer(newPlayer.player);
            const addedPlayerAsset = newPlayer.player.playableNFT;
            expect(addedPlayer).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            expect(oneVsNpc.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
                addedPlayerAsset
            );
            const tryAddingAgain = oneVsNpc.addPlayer(newPlayer.player);
            expect(tryAddingAgain).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            expect(oneVsNpc.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
                addedPlayerAsset
            );
        });
        it('should not add a new player but change the asset to the game because the player is in the game and the asset is different', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const newPlayer = await createRandomPlayer(database);
            const addedPlayer = oneVsNpc.addPlayer(newPlayer.player);
            const addedPlayerAsset = newPlayer.player.playableNFT;
            expect(addedPlayer).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            expect(oneVsNpc.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
                addedPlayerAsset
            );
            const newAsset = await addRandomAssetAndWalletToUser(
                database,
                newPlayer.databasePlayer.user
            );
            const playerWithNewAsset = new Player(newPlayer.databasePlayer.user, newAsset.asset);
            const tryAddingAgain = oneVsNpc.addPlayer(playerWithNewAsset);
            expect(tryAddingAgain).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            expect(oneVsNpc.getPlayer(newPlayer.databasePlayer.user.id)?.playableNFT).toEqual(
                newAsset.asset
            );
        });
    });
    describe('Remove player from the game', () => {
        it('should remove a player from the game', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const newPlayer = await createRandomPlayer(database);
            const addedPlayer = oneVsNpc.addPlayer(newPlayer.player);
            expect(addedPlayer).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            const removedPlayer = oneVsNpc.removePlayer(newPlayer.databasePlayer.user.id);
            expect(removedPlayer).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(0);
        });
        it('should not remove a player from the game because the player is not in the game', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const newPlayer = await createRandomPlayer(database);
            const addedPlayer = oneVsNpc.addPlayer(newPlayer.player);
            expect(addedPlayer).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(1);
            const removedPlayer = oneVsNpc.removePlayer('fakeId');
            expect(removedPlayer).toBeFalsy();
            expect(oneVsNpc.players).toHaveLength(1);
        });
        it('should remove all players from the game', async () => {
            const oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            const newPlayer = await createRandomPlayer(database);
            const newPlayer2 = await createRandomPlayer(database);
            const addedPlayer = oneVsNpc.addPlayer(newPlayer.player);
            const addedPlayer2 = oneVsNpc.addPlayer(newPlayer2.player);
            expect(addedPlayer).toBeTruthy();
            expect(addedPlayer2).toBeTruthy();
            expect(oneVsNpc.players).toHaveLength(2);
            oneVsNpc.removeAllPlayers();
            expect(oneVsNpc.players).toHaveLength(0);
        });
    });
    describe('Rolls and Rounds Winners etc', () => {
        let oneVsNpc: Game;
        let player: Player;
        beforeEach(async () => {
            await database.getRepository(AlgoWallet).createNPCsIfNotExists();
            oneVsNpc = await createRandomGame(database, client, GameTypes.OneVsNpc);
            await oneVsNpc.addNpc();
            // set the bot to the longest game
            oneVsNpc.players[0].roundsData = playerRoundsDataLongestGame;
            const newPlayer = await createRandomPlayer(database);
            player = newPlayer.player;
            // change player to have a fastest win game
            player.roundsData = playerRoundsDataPerfectGame;
            oneVsNpc.addPlayer(player);
            oneVsNpc.setCurrentPlayer(player, 1);
        });
        it('should have a default game round state', () => {
            expect(oneVsNpc.players).toHaveLength(2);
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.rollIndex).toEqual(0);
            expect(oneVsNpc.gameRoundState.roundIndex).toEqual(0);
        });
        it('should increment the roll not the round and the game should not have a winner', () => {
            oneVsNpc.nextRoll();
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.rollIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.roundIndex).toEqual(0);
        });
        it('game is at roll 2 and incrementing the roll should increment the round and the game should not have a winner', () => {
            oneVsNpc.nextRoll();
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.rollIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.roundIndex).toEqual(0);
            oneVsNpc.nextRoll();
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.rollIndex).toEqual(2);
            expect(oneVsNpc.gameRoundState.roundIndex).toEqual(0);
            oneVsNpc.nextRoll();
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.rollIndex).toEqual(0);
            expect(oneVsNpc.gameRoundState.roundIndex).toEqual(1);
        });
        it('game is right before final roll and incrementing the roll should advance the round and the game should not have a winner', () => {
            oneVsNpc.gameRoundState.rollIndex = 2;
            oneVsNpc.gameRoundState.roundIndex = 2;
            oneVsNpc.nextRoll();
            expect(oneVsNpc.status).toEqual(GameStatus.maintenance);
            expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
            expect(oneVsNpc.gameRoundState.rollIndex).toEqual(0);
            expect(oneVsNpc.gameRoundState.roundIndex).toEqual(3);
        });
        describe('add processing of winners with findZenAndWinners', () => {
            it('should find the zen and winners', () => {
                oneVsNpc.findZenAndWinners();
                expect(oneVsNpc.gameWinInfo.gameWinRollIndex).toEqual(0);
                expect(oneVsNpc.gameWinInfo.gameWinRoundIndex).toEqual(2);
                expect(oneVsNpc.gameWinInfo.payout).toEqual(5);
                expect(oneVsNpc.gameWinInfo.zen).toEqual(false);
            });
            it('should set the game status to winner', () => {
                oneVsNpc.findZenAndWinners();
                for (let index = 0; index < 7; index++) {
                    oneVsNpc.nextRoll();
                }
                expect(oneVsNpc.gameRoundState.playerIndex).toEqual(1);
                expect(oneVsNpc.gameRoundState.rollIndex).toEqual(0);
                expect(oneVsNpc.gameRoundState.roundIndex).toEqual(2);
                expect(oneVsNpc.status).toEqual(GameStatus.win);
            });
            it('winner should be player 1', () => {
                oneVsNpc.findZenAndWinners();
                expect(player.isWinner).toBeTruthy();
            });
            it('change bot to have incrementing game, same round different roll', () => {
                oneVsNpc.players[0].roundsData = playerRoundsDataIncrementingRolls;
                oneVsNpc.findZenAndWinners();
                expect(oneVsNpc.gameWinInfo.gameWinRollIndex).toEqual(0);
                expect(oneVsNpc.gameWinInfo.gameWinRoundIndex).toEqual(2);
                expect(oneVsNpc.gameWinInfo.payout).toEqual(5);
                expect(oneVsNpc.gameWinInfo.zen).toEqual(false);
                expect(player.isWinner).toBeTruthy();
            });
            it('change bot to have same game as player to have zen', () => {
                oneVsNpc.players[0].roundsData = playerRoundsDataPerfectGame;
                oneVsNpc.findZenAndWinners();
                expect(oneVsNpc.gameWinInfo.gameWinRollIndex).toEqual(0);
                expect(oneVsNpc.gameWinInfo.gameWinRoundIndex).toEqual(2);
                expect(oneVsNpc.gameWinInfo.payout).toEqual(5);
                expect(oneVsNpc.gameWinInfo.zen).toEqual(true);
                expect(player.isWinner).toBeTruthy();
                expect(oneVsNpc.players[0].isWinner).toBeTruthy();
            });
        });
    });
});
