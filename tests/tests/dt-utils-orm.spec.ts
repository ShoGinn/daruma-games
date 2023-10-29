import { EntityManager, MikroORM } from '@mikro-orm/core';
import { GuildMember } from 'discord.js';

import { AlgoNFTAsset, AlgoNFTAssetRepository } from '../../src/entities/algo-nft-asset.entity.js';
import { User } from '../../src/entities/user.entity.js';
import * as dtUtils from '../../src/utils/functions/dt-utils.js';
import { mockCustomCache } from '../mocks/mock-custom-cache.js';
import { initORM } from '../utils/bootstrap.js';
import {
  addRandomAssetAndWalletToUser,
  createRandomAsset,
  createRandomUserWithWalletAndAsset,
} from '../utils/test-funcs.js';
jest.mock('../../src/services/custom-cache.js', () => ({
  CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));
describe('asset tests that require db', () => {
  let orm: MikroORM;
  let database: EntityManager;
  let algoNFTAssetRepo: AlgoNFTAssetRepository;
  let user: User;
  let asset: AlgoNFTAsset;
  let memberMock: GuildMember;
  beforeAll(async () => {
    orm = await initORM();
  });
  afterAll(async () => {
    await orm.close(true);
  });
  beforeEach(async () => {
    await orm.schema.clearDatabase();
    database = orm.em.fork();
    algoNFTAssetRepo = database.getRepository(AlgoNFTAsset);
    const newUser = await createRandomUserWithWalletAndAsset(database);
    user = newUser.user;
    asset = newUser.asset.asset;
    memberMock = {
      id: user.id,
    } as GuildMember;
  });
  describe('assetCurrentRank', () => {
    test('gets the assets current rank when you have no wins or losses', async () => {
      const result = await dtUtils.assetCurrentRank(asset);
      expect(result).toEqual({ currentRank: '0', totalAssets: '0' });
    });
    test('gets the assets current rank when it has some wins and another asset does not', async () => {
      const { asset: asset2 } = await createRandomAsset(database);
      // Generate a user with a wallet and asset
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, {
        wins: 1,
        losses: 0,
        zen: 1,
      });
      const result = await dtUtils.assetCurrentRank(asset2);
      expect(result).toEqual({ currentRank: '1', totalAssets: '1' });
    });
    test('gets the assets current rank when it has some wins and another asset has less wins', async () => {
      await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, {
        wins: 1,
        losses: 1,
        zen: 1,
      });

      const { asset: asset2 } = await createRandomAsset(database);
      // Generate a user with a wallet and asset
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, {
        wins: 10,
        losses: 1,
        zen: 1,
      });
      const result = await dtUtils.assetCurrentRank(asset2);
      expect(result).toEqual({ currentRank: '1', totalAssets: '2' });
    });
    test('gets the assets current rank when it has less wins and another asset has more wins', async () => {
      await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, {
        wins: 10,
        losses: 1,
        zen: 1,
      });

      const { asset: asset2 } = await createRandomAsset(database);
      // Generate a user with a wallet and asset
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, {
        wins: 1,
        losses: 1,
        zen: 1,
      });
      const result = await dtUtils.assetCurrentRank(asset2);
      expect(result).toEqual({ currentRank: '2', totalAssets: '2' });
    });
  });
  describe('coolDownsDescending', () => {
    test('returns an empty array when no assets exist', async () => {
      const result = await dtUtils.coolDownsDescending(memberMock);
      expect(result).toEqual([]);
    });
    test('checks the results when one asset has a cooldown to include the 1 result', async () => {
      const userWithWalletAndAsset = await createRandomUserWithWalletAndAsset(database);
      await algoNFTAssetRepo.assetEndGameUpdate(userWithWalletAndAsset.asset.asset, 50_000, {
        wins: 1,
        losses: 1,
        zen: 1,
      });
      const otherMockMember = {
        id: userWithWalletAndAsset.user.id,
      } as GuildMember;

      const result = await dtUtils.coolDownsDescending(otherMockMember);
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(userWithWalletAndAsset.asset.asset.id);
    });
    test('checks the results when 2 assets have a cooldown and they are in the correct order', async () => {
      const userWithWalletAndAsset = await createRandomUserWithWalletAndAsset(database);
      await algoNFTAssetRepo.assetEndGameUpdate(userWithWalletAndAsset.asset.asset, 50_000, {
        wins: 1,
        losses: 1,
        zen: 1,
      });
      const otherMockMember = {
        id: userWithWalletAndAsset.user.id,
      } as GuildMember;

      const result = await dtUtils.coolDownsDescending(otherMockMember);
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(userWithWalletAndAsset.asset.asset.id);
      const { asset: asset2 } = await addRandomAssetAndWalletToUser(
        database,
        userWithWalletAndAsset.user,
      );
      await algoNFTAssetRepo.assetEndGameUpdate(asset2, 100_000, {
        wins: 1,
        losses: 1,
        zen: 1,
      });

      const result2 = await dtUtils.coolDownsDescending(otherMockMember);
      expect(result2).toHaveLength(2);
      expect(result2[0].id).toEqual(asset2.id);
      expect(result2[1].id).toEqual(userWithWalletAndAsset.asset.asset.id);
    });
  });
  describe('getAverageDarumaOwned', () => {
    test('returns 0 because no other assets exists', async () => {
      await orm.schema.clearDatabase();
      const result = await dtUtils.getAverageDarumaOwned();
      expect(result).toBe(0);
    });
    test('returns 1 because no matter how many users have 1 its average is 1', async () => {
      await createRandomUserWithWalletAndAsset(database);
      await createRandomUserWithWalletAndAsset(database);
      await createRandomUserWithWalletAndAsset(database);
      const result = await dtUtils.getAverageDarumaOwned();
      expect(result).toBe(1);
    });
    test('returns 2 because a user has 3 assets and 1 has 1', async () => {
      await createRandomUserWithWalletAndAsset(database);
      await addRandomAssetAndWalletToUser(database, user);
      await addRandomAssetAndWalletToUser(database, user);
      const result = await dtUtils.getAverageDarumaOwned();
      expect(result).toBe(2);
    });
  });
});
