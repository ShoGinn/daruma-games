import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { AlgoWallet } from '../../src/entities/AlgoWallet.entity.js';
import { User } from '../../src/entities/User.entity.js';
import { GameAssets } from '../../src/model/logic/gameAssets.js';
import { gameWinInfo } from '../../src/model/types/darumaTraining.js';
import { Game } from '../../src/utils/classes/dtGame.js';
import { Player } from '../../src/utils/classes/dtPlayer.js';
import { initORM } from '../utils/bootstrap.js';
import { addRandomUserToGame, createRandomASA, createRandomGame } from '../utils/testFuncs.js';
jest.mock('../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        // returns a mock random wallet
        getCreatedAssets: jest.fn().mockReturnValue([]),
        updateAssetMetadata: jest.fn().mockReturnValue(0),
        createFakeWallet: jest.fn().mockReturnValue(Math.random().toString(36).substring(7)),
        getAllStdAssets: jest.fn().mockReturnValue([]),
        getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: false, tokens: 10 }),
        lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
    })),
}));

describe('The Player class', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let client: Client;
    let randomGame: Game;
    let player: Player;
    let gameAssets: GameAssets;
    let user: User;
    let wallet: AlgoWallet;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        db = orm.em.fork();
        client = container.resolve(Client);
        gameAssets = container.resolve(GameAssets);
        randomGame = await createRandomGame(db, client);
        const newPlayer = await addRandomUserToGame(db, client, randomGame);
        user = newPlayer.user;
        wallet = newPlayer.wallet;
        player = randomGame.getPlayer(user.id) as Player;
    });
    afterEach(async () => {
        await orm.schema.clearDatabase();
    });

    it('should return that the player is not an npc', () => {
        expect(player.isNpc).toBeFalsy();
    });
    it('should throw an error because the karma asset is not found', async () => {
        const gameWinInfo: gameWinInfo = {
            gameWinRollIndex: 0,
            gameWinRoundIndex: 0,
            zen: false,
            payout: 0,
        };
        try {
            await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
        } catch (error) {
            expect(error).toHaveProperty('message', 'Karma Asset Not Found');
        }
    });
    it('should update the end game data', async () => {
        await createRandomASA(db, 'KRMA', 'KRMA');
        await gameAssets.initKRMA();
        const algoWalletRepo = db.getRepository(AlgoWallet);
        await algoWalletRepo.addAllAlgoStdAssetFromDB(wallet.address);
        const gameWinInfo: gameWinInfo = {
            gameWinRollIndex: 0,
            gameWinRoundIndex: 0,
            zen: false,
            payout: 0,
        };
        await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
        expect(player.playableNFT.dojoLosses).toBe(1);
        expect(player.coolDownModified).toBeFalsy();
        expect(player.randomCoolDown).toBe(0);
        gameWinInfo.zen = true;
        player.isWinner = true;
        await player.userAndAssetEndGameUpdate(gameWinInfo, 500);
        expect(player.playableNFT.dojoWins).toBe(1);
        expect(player.isWinner).toBeTruthy();
    });
    it('should return because the user is an NPC', async () => {
        player.playableNFT.id = 1;
        const gameWinInfo: gameWinInfo = {
            gameWinRollIndex: 0,
            gameWinRoundIndex: 0,
            zen: false,
            payout: 0,
        };
        expect(player.isNpc).toBeTruthy();
        await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
    });
});
