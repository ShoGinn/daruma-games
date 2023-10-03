import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { AlgoWallet } from '../../src/entities/algo-wallet.entity.js';
import { User } from '../../src/entities/user.entity.js';
import { GameAssets } from '../../src/model/logic/game-assets.js';
import { GameWinInfo } from '../../src/model/types/daruma-training.js';
import { Game } from '../../src/utils/classes/dt-game.js';
import { Player } from '../../src/utils/classes/dt-player.js';
import { initORM } from '../utils/bootstrap.js';
import {
	addRandomUserToGame,
	createRandomASA,
	createRandomGame,
} from '../utils/test-funcs.js';
jest.mock('../../src/services/algorand.js', () => ({
	Algorand: jest.fn().mockImplementation(() => ({
		// returns a mock random wallet
		getCreatedAssets: jest.fn().mockReturnValue([]),
		updateAssetMetadata: jest.fn().mockReturnValue(0),
		createFakeWallet: jest
			.fn()
			.mockReturnValue(Math.random().toString(36).slice(7)),
		getAllStdAssets: jest.fn().mockReturnValue([]),
		getTokenOptInStatus: jest
			.fn()
			.mockReturnValue({ optedIn: false, tokens: 10 }),
		lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
	})),
}));

describe('The Player class', () => {
	let orm: MikroORM;
	let database: EntityManager;
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
		database = orm.em.fork();
		client = container.resolve(Client);
		gameAssets = container.resolve(GameAssets);
		randomGame = await createRandomGame(database, client);
		const newPlayer = await addRandomUserToGame(database, client, randomGame);
		user = newPlayer.user;
		wallet = newPlayer.wallet;
		player = randomGame.getPlayer(user.id) ;
	});
	afterEach(async () => {
		await orm.schema.clearDatabase();
	});

	it('should return that the player is not an npc', () => {
		expect(player.isNpc).toBeFalsy();
	});
	it('should throw an error because the karma asset is not found', async () => {
		const gameWinInfo: GameWinInfo = {
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
		await createRandomASA(database, 'KRMA', 'KRMA');
		await gameAssets.initKRMA();
		const algoWalletRepo = database.getRepository(AlgoWallet);
		await algoWalletRepo.addAllAlgoStdAssetFromDB(wallet.address);
		const gameWinInfo: GameWinInfo = {
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
		const gameWinInfo: GameWinInfo = {
			gameWinRollIndex: 0,
			gameWinRoundIndex: 0,
			zen: false,
			payout: 0,
		};
		expect(player.isNpc).toBeTruthy();
		await player.userAndAssetEndGameUpdate(gameWinInfo, 0);
	});
});
