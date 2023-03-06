import { EntityManager, MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { AlgoNFTAsset, AlgoNFTAssetRepository } from '../../../src/entities/AlgoNFTAsset.entity.js';
import { CustomCache } from '../../../src/services/CustomCache.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomAsset } from '../../utils/testFuncs.js';

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let algoNFTAssetRepo: AlgoNFTAssetRepository;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        algoNFTAssetRepo = db.getRepository(AlgoNFTAsset);
    });
    describe('assetRankingByWinsTotalGames', () => {
        it('checks that the asset ranking is correct when only 1 asset has played a game and it runs it again to see if the cache is used.', async () => {
            const { asset } = await createRandomAsset(db);

            // update the first asset to have 1 win and 1 loss
            await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 0, losses: 1, zen: 0 });

            const ranking = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(1);
            expect(ranking[0].id).toEqual(asset.id);
            const customCache = container.resolve(CustomCache);
            const sortedAssets: Array<AlgoNFTAsset> | undefined = customCache.get('rankedAssets');

            const ranking2 = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking2).toBeDefined();
            expect(ranking2).toHaveLength(1);
            expect(sortedAssets).toBeDefined();
            expect(sortedAssets).toHaveLength(1);
            expect(sortedAssets).toEqual(ranking2);
        });
    });
});
