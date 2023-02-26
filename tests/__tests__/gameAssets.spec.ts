import { EntityManager, MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { GameAssets } from '../../src/model/logic/gameAssets.js';
import { initORM } from '../utils/bootstrap.js';
import { createRandomASA } from '../utils/testFuncs.js';

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
    });
    describe('Check if the game assets are available', () => {
        it('should return not ready and undefined', () => {
            const gameAssets = container.resolve(GameAssets);
            expect(gameAssets.isReady()).toBe(false);
            expect(gameAssets.karmaAsset).toBe(undefined);
            expect(gameAssets.enlightenmentAsset).toBe(undefined);
        });
        it('should return an array of 2 undefined when trying to initialize the assets', async () => {
            const gameAssets = container.resolve(GameAssets);
            expect(await gameAssets.initAll()).toEqual([false, false]);
            expect(gameAssets.isReady()).toBe(false);
        });
        it('create one of the assets and check if it is ready', async () => {
            const gameAssets = container.resolve(GameAssets);
            createRandomASA(db, 'KRMA', 'KRMA');
            expect(await gameAssets.initKRMA()).toBe(true);
            expect(await gameAssets.initAll()).toEqual([true, false]);
            expect(gameAssets.isReady()).toBe(false);
            expect(gameAssets.karmaAsset).not.toBe(undefined);
            expect(gameAssets.enlightenmentAsset).toBe(undefined);
        });
        it('create both assets and check if it is ready', async () => {
            const gameAssets = container.resolve(GameAssets);
            expect(await gameAssets.initAll()).toEqual([false, false]);
            createRandomASA(db, 'KRMA', 'KRMA');
            createRandomASA(db, 'ENLT', 'ENLT');
            expect(await gameAssets.initAll()).toEqual([true, true]);
            expect(await gameAssets.initKRMA()).toBe(true);
            expect(await gameAssets.initENLT()).toBe(true);
            expect(await gameAssets.initAll()).toEqual([true, true]);
            expect(gameAssets.isReady()).toBe(true);
        });
    });
});
