import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import {
	DtEncounters,
	DtEncountersRepository,
} from '../../../src/entities/dt-encounters.entity.js';
import { initORM } from '../../utils/bootstrap.js';
import {
	addRandomUserToGame,
	createRandomGame,
} from '../../utils/test-funcs.js';

describe('asset tests that require db', () => {
	let orm: MikroORM;
	let database: EntityManager;
	let dtEncountersRepo: DtEncountersRepository;
	let client: Client;
	beforeAll(async () => {
		orm = await initORM();
	});
	afterAll(async () => {
		await orm.close(true);
	});
	beforeEach(async () => {
		await orm.schema.clearDatabase();
		database = orm.em.fork();
		dtEncountersRepo = database.getRepository(DtEncounters);
		client = container.resolve(Client);
	});
	describe('createEncounter', () => {
		it('should create a new encounter without gameData', async () => {
			const randomGame = await createRandomGame(database, client);
			const encounter = await dtEncountersRepo.createEncounter(randomGame);
			expect(encounter).toBeInstanceOf(DtEncounters);
			expect(encounter.gameType).toBe(randomGame.settings.gameType);
			expect(encounter.channelId).toBe(randomGame.settings.channelId);
			expect(encounter.gameData).toEqual({});
		});
		it('should create a new encounter with one players gameData', async () => {
			const randomGame = await createRandomGame(database, client);
			const databasePlayer = await addRandomUserToGame(
				database,
				client,
				randomGame,
			);
			const encounter = await dtEncountersRepo.createEncounter(randomGame);
			expect(encounter).toBeInstanceOf(DtEncounters);
			expect(encounter.gameType).toBe(randomGame.settings.gameType);
			expect(encounter.channelId).toBe(randomGame.settings.channelId);
			expect(encounter.gameData).toHaveProperty(
				databasePlayer.asset.asset.id.toString(),
			);
			expect(
				encounter.gameData[databasePlayer.asset.asset.id.toString()],
			).toHaveProperty('gameWinRollIndex');
		});
		it('should create a new encounter with multiple players gameData', async () => {
			const randomGame = await createRandomGame(database, client);
			const databasePlayer1 = await addRandomUserToGame(
				database,
				client,
				randomGame,
			);
			const databasePlayer2 = await addRandomUserToGame(
				database,
				client,
				randomGame,
			);
			const encounter = await dtEncountersRepo.createEncounter(randomGame);
			expect(encounter).toBeInstanceOf(DtEncounters);
			expect(encounter.gameType).toBe(randomGame.settings.gameType);
			expect(encounter.channelId).toBe(randomGame.settings.channelId);
			expect(encounter.gameData).toHaveProperty(
				databasePlayer1.asset.asset.id.toString(),
			);
			expect(encounter.gameData).toHaveProperty(
				databasePlayer2.asset.asset.id.toString(),
			);
			expect(
				encounter.gameData[databasePlayer1.asset.asset.id.toString()],
			).toHaveProperty('gameWinRollIndex');
			expect(
				encounter.gameData[databasePlayer2.asset.asset.id.toString()],
			).toHaveProperty('gameWinRollIndex');
		});
	});
});
