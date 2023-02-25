import { EntityManager, MikroORM } from '@mikro-orm/core';
import { Client } from 'discordx';
import { container } from 'tsyringe';

import { DtEncounters, DtEncountersRepository } from '../../../src/entities/DtEncounters.entity.js';
import { initORM } from '../../utils/bootstrap.js';
import { addRandomUserToGame, createRandomGame } from '../../utils/testFuncs.js';

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
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
        db = orm.em.fork();
        dtEncountersRepo = db.getRepository(DtEncounters);
        client = container.resolve(Client);
    });
    describe('createEncounter', () => {
        it('should create a new encounter without gameData', async () => {
            const randomGame = await createRandomGame(db, client);
            const encounter = await dtEncountersRepo.createEncounter(randomGame);
            expect(encounter).toBeInstanceOf(DtEncounters);
            expect(encounter.gameType).toBe(randomGame.settings.gameType);
            expect(encounter.channelId).toBe(randomGame.settings.channelId);
            expect(encounter.gameData).toEqual({});
        });
        it('should create a new encounter with one players gameData', async () => {
            const randomGame = await createRandomGame(db, client);
            const dbPlayer = await addRandomUserToGame(db, client, randomGame);
            const encounter = await dtEncountersRepo.createEncounter(randomGame);
            expect(encounter).toBeInstanceOf(DtEncounters);
            expect(encounter.gameType).toBe(randomGame.settings.gameType);
            expect(encounter.channelId).toBe(randomGame.settings.channelId);
            expect(encounter.gameData).toHaveProperty(dbPlayer.asset.asset.id.toString());
            expect(encounter.gameData[dbPlayer.asset.asset.id.toString()]).toHaveProperty(
                'gameWinRollIndex'
            );
        });
        it('should create a new encounter with multiple players gameData', async () => {
            const randomGame = await createRandomGame(db, client);
            const dbPlayer1 = await addRandomUserToGame(db, client, randomGame);
            const dbPlayer2 = await addRandomUserToGame(db, client, randomGame);
            const encounter = await dtEncountersRepo.createEncounter(randomGame);
            expect(encounter).toBeInstanceOf(DtEncounters);
            expect(encounter.gameType).toBe(randomGame.settings.gameType);
            expect(encounter.channelId).toBe(randomGame.settings.channelId);
            expect(encounter.gameData).toHaveProperty(dbPlayer1.asset.asset.id.toString());
            expect(encounter.gameData).toHaveProperty(dbPlayer2.asset.asset.id.toString());
            expect(encounter.gameData[dbPlayer1.asset.asset.id.toString()]).toHaveProperty(
                'gameWinRollIndex'
            );
            expect(encounter.gameData[dbPlayer2.asset.asset.id.toString()]).toHaveProperty(
                'gameWinRollIndex'
            );
        });
    });
});
