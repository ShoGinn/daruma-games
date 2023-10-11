import { EntityManager, MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { GameAssets } from '../../src/model/logic/game-assets.js';
import { initORM } from '../utils/bootstrap.js';
import { createRandomASA } from '../utils/test-funcs.js';

describe('asset tests that require db', () => {
  let orm: MikroORM;
  let database: EntityManager;
  beforeAll(async () => {
    orm = await initORM();
  });
  afterAll(async () => {
    await orm.close(true);
  });
  beforeEach(async () => {
    await orm.schema.clearDatabase();
    database = orm.em.fork();
  });
  describe('Check if the game assets are available', () => {
    test('should return not ready and undefined', () => {
      const gameAssets = container.resolve(GameAssets);
      expect(gameAssets.isReady()).toBe(false);
      expect(gameAssets.karmaAsset).toBe(undefined);
      expect(gameAssets.enlightenmentAsset).toBe(undefined);
    });
    test('should return an array of 2 undefined when trying to initialize the assets', async () => {
      const gameAssets = container.resolve(GameAssets);
      expect(await gameAssets.initAll()).toEqual([false, false]);
      expect(gameAssets.isReady()).toBe(false);
    });
    test('create one of the assets and check if it is ready', async () => {
      const gameAssets = container.resolve(GameAssets);
      await createRandomASA(database, 'KRMA', 'KRMA');
      expect(await gameAssets.initKRMA()).toBe(true);
      expect(await gameAssets.initAll()).toEqual([true, false]);
      expect(gameAssets.isReady()).toBe(false);
      expect(gameAssets.karmaAsset).not.toBe(undefined);
      expect(gameAssets.enlightenmentAsset).toBe(undefined);
    });
    test('create both assets and check if it is ready', async () => {
      const gameAssets = container.resolve(GameAssets);
      expect(await gameAssets.initAll()).toEqual([false, false]);
      await createRandomASA(database, 'KRMA', 'KRMA');
      await createRandomASA(database, 'ENLT', 'ENLT');
      expect(await gameAssets.initAll()).toEqual([true, true]);
      expect(await gameAssets.initKRMA()).toBe(true);
      expect(await gameAssets.initENLT()).toBe(true);
      expect(await gameAssets.initAll()).toEqual([true, true]);
      expect(gameAssets.isReady()).toBe(true);
    });
  });
});
