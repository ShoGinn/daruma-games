import type { AssetResult } from '../../../src/model/types/algorand.js';
import { EntityManager, MikroORM } from '@mikro-orm/core';

import { AlgoNFTAsset, AlgoNFTAssetRepository } from '../../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/AlgoWallet.entity.js';
import { mockCustomCache } from '../../mocks/mockCustomCache.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomAsset, createRandomUser, createRandomWallet } from '../../utils/testFuncs.js';

jest.mock('../../../src/services/CustomCache.js', () => ({
    CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));

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
    it('findById', async () => {
        const { asset } = await createRandomAsset(db);
        const assetFromDb = await algoNFTAssetRepo.findOne(asset.id);
        expect(assetFromDb).toBeDefined();
        expect(assetFromDb?.id).toEqual(asset.id);
    });
    it('getAllPlayerAssets', async () => {
        const { asset } = await createRandomAsset(db);

        const assetFromDb = await algoNFTAssetRepo.getAllPlayerAssets();
        expect(assetFromDb).toBeDefined();
        expect(assetFromDb).toHaveLength(1);
        expect(assetFromDb[0].id).toEqual(asset.id);
        expect(assetFromDb[1]).toBeUndefined();
    });
    describe('getOwnerWalletFromAssetIndex', () => {
        it('(expect to throw error that owner wallet not found)', async () => {
            expect.assertions(2);
            const { asset } = await createRandomAsset(db);

            try {
                await algoNFTAssetRepo.getOwnerWalletFromAssetIndex(asset?.id);
            } catch (e) {
                expect(e).toBeDefined();
                expect(e).toHaveProperty('message', 'Owner wallet not found');
            }
        });
        it('(expect to throw error with no asset)', async () => {
            expect.assertions(2);
            try {
                await algoNFTAssetRepo.getOwnerWalletFromAssetIndex(55);
            } catch (e) {
                expect(e).toBeDefined();
                expect(e).toHaveProperty('message', 'AlgoNFTAsset not found ({ id: 55 })');
            }
        });
        it('expect to return owner wallet', async () => {
            const assetUser = await createRandomUser(db);
            const userWallet = await createRandomWallet(assetUser, db);
            const { asset: newAsset } = await createRandomAsset(db);
            userWallet.nft.add(newAsset);
            const algoWalletRepo = db.getRepository(AlgoWallet);
            await algoWalletRepo.flush();
            db = orm.em.fork();
            algoNFTAssetRepo = db.getRepository(AlgoNFTAsset);
            const wallet = await algoNFTAssetRepo.getOwnerWalletFromAssetIndex(newAsset.id);
            expect(wallet).toBeDefined();
        });
    });
    describe('addAssetsLookup', () => {
        it('adds assets from the algorand network', async () => {
            const algoAsset: AssetResult = {
                index: 123456,
                'created-at-round': 1,
                'deleted-at-round': 0,
                params: {
                    creator: 'test',
                    total: 1,
                    decimals: 0,
                },
            };
            const { asset, creatorWallet } = await createRandomAsset(db);

            await algoNFTAssetRepo.addAssetsLookup(creatorWallet, [algoAsset]);
            const assetFromDb = await algoNFTAssetRepo.findOne(asset.id);
            expect(assetFromDb).toBeDefined();
            expect(assetFromDb?.id).toEqual(asset.id);
            expect(assetFromDb?.name).toEqual(asset.name);
            expect(assetFromDb?.unitName).toEqual(asset.unitName);
            expect(assetFromDb?.url).toEqual(asset.url);
        });
    });
    describe('assetEndGameUpdate', () => {
        it('checks that the end game update works as intended', async () => {
            const { asset } = await createRandomAsset(db);

            algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 1, losses: 0, zen: 0 });
            const assetFromDb = await algoNFTAssetRepo.findOne(asset.id);
            expect(assetFromDb).toBeDefined();
            expect(assetFromDb?.id).toEqual(asset.id);
            expect(assetFromDb?.dojoCoolDown).toBeInstanceOf(Date);
            expect(assetFromDb?.dojoWins).toEqual(1);
            expect(assetFromDb?.dojoLosses).toEqual(0);
            expect(assetFromDb?.dojoZen).toEqual(0);
        });
    });
    describe('zeroOutAssetCoolDown', () => {
        it('checks that the asset cooldown has been zeroed', async () => {
            const { asset } = await createRandomAsset(db);

            algoNFTAssetRepo.zeroOutAssetCooldown(asset);
            const assetFromDb = await algoNFTAssetRepo.findOne(asset.id);
            expect(assetFromDb).toBeDefined();
            expect(assetFromDb?.id).toEqual(asset.id);
            expect(assetFromDb?.dojoCoolDown).toEqual(new Date(0));
        });
    });

    describe('createNPCAsset', () => {
        let algoWallet: AlgoWalletRepository;
        let fakeWallet: AlgoWallet;
        const fakeAsset = {
            assetIndex: 123456,
            name: 'Fake Asset',
            unitName: 'FAK',
            url: 'https://fakeasset.com',
        };

        beforeEach(async () => {
            const { creatorUser } = await createRandomAsset(db);

            algoWallet = db.getRepository(AlgoWallet);
            fakeWallet = new AlgoWallet('fake', creatorUser);
            await algoWallet.persistAndFlush(fakeWallet);
        });
        it('creates a new asset if it does not exist', async () => {
            const result = await algoNFTAssetRepo.createNPCAsset(fakeWallet, fakeAsset);
            const assetFromDb = await algoNFTAssetRepo.findOne(fakeAsset.assetIndex);
            expect(result).toBeUndefined();
            expect(assetFromDb?.id).toEqual(fakeAsset.assetIndex);
            expect(assetFromDb?.name).toEqual(fakeAsset.name);
            expect(assetFromDb?.unitName).toEqual(fakeAsset.unitName);
            expect(assetFromDb?.url).toEqual(fakeAsset.url);
        });
        it('updates an existing asset if it already exists', async () => {
            // Create an asset with the given ID
            await algoNFTAssetRepo.createNPCAsset(fakeWallet, fakeAsset);

            // Call createNPCAsset with the same ID but different name, unitName, and URL
            const updatedAssetData = {
                assetIndex: 123456,
                name: 'Updated Name',
                unitName: 'UPD',
                url: 'https://updatedasset.com',
            };
            const result = await algoNFTAssetRepo.createNPCAsset(fakeWallet, updatedAssetData);

            // Query the asset from the database and test that the updated values were saved correctly
            const assetFromDb = await algoNFTAssetRepo.findOne(updatedAssetData.assetIndex);
            expect(result).toBeUndefined();
            expect(assetFromDb?.id).toEqual(updatedAssetData.assetIndex);
            expect(assetFromDb?.name).toEqual(updatedAssetData.name);
            expect(assetFromDb?.unitName).toEqual(updatedAssetData.unitName);
            expect(assetFromDb?.url).toEqual(updatedAssetData.url);
        });
    });
    describe('assetRankingByWinsTotalGames', () => {
        it('checks that the asset ranking is correct with a 0 win 0 loss', async () => {
            await createRandomAsset(db);

            const ranking = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(0);
        });
        it('checks that the asset ranking is correct when 4 assets are created and 2 both have same wins but one has 0 losses', async () => {
            const { asset } = await createRandomAsset(db);

            // create 3 more assets
            const { asset: asset2 } = await createRandomAsset(db);
            const { asset: asset3 } = await createRandomAsset(db);
            const { asset: asset4 } = await createRandomAsset(db);
            // update the first asset to have 1 win and 1 loss
            await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 5, losses: 1, zen: 0 });
            // update the second asset to have 1 win and 0 losses
            await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, { wins: 3, losses: 1, zen: 0 });
            // update the third asset to have 0 wins and 1 loss
            await algoNFTAssetRepo.assetEndGameUpdate(asset3, 1, { wins: 2, losses: 0, zen: 0 });
            // update the fourth asset to have 0 wins and 0 losses
            await algoNFTAssetRepo.assetEndGameUpdate(asset4, 1, { wins: 2, losses: 1, zen: 0 });

            const ranking = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(4);
            expect(ranking[0].id).toEqual(asset.id);
            expect(ranking[1].id).toEqual(asset2.id);
            expect(ranking[2].id).toEqual(asset3.id);
            expect(ranking[3].id).toEqual(asset4.id);
        });

        it('checks that the asset ranking is correct when 4 assets are created and one has no wins', async () => {
            const { asset } = await createRandomAsset(db);

            // create 3 more assets
            const { asset: asset2 } = await createRandomAsset(db);
            const { asset: asset3 } = await createRandomAsset(db);
            const { asset: asset4 } = await createRandomAsset(db);
            // update the first asset to have 1 win and 1 loss
            await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 5, losses: 1, zen: 0 });
            // update the second asset to have 1 win and 0 losses
            await algoNFTAssetRepo.assetEndGameUpdate(asset2, 1, { wins: 3, losses: 1, zen: 0 });
            // update the third asset to have 0 wins and 1 loss
            await algoNFTAssetRepo.assetEndGameUpdate(asset3, 1, { wins: 2, losses: 1, zen: 0 });
            // update the fourth asset to have 0 wins and 0 losses
            await algoNFTAssetRepo.assetEndGameUpdate(asset4, 1, { wins: 0, losses: 0, zen: 0 });

            const ranking = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(3);
            expect(ranking[0].id).toEqual(asset.id);
            expect(ranking[1].id).toEqual(asset2.id);
            expect(ranking[2].id).toEqual(asset3.id);
        });
    });
    describe('assetTotalGames', () => {
        it('checks that the asset total games is correct with a 0 win 0 loss', async () => {
            const { asset } = await createRandomAsset(db);

            const totalGames = algoNFTAssetRepo.assetTotalGames(asset);
            expect(totalGames).toBeDefined();
            expect(totalGames).toEqual(0);
        });
        it('checks that the asset total games is correct with a 1 win 1 loss', async () => {
            const { asset } = await createRandomAsset(db);

            await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 1, losses: 1, zen: 0 });
            const totalGames = algoNFTAssetRepo.assetTotalGames(asset);
            expect(totalGames).toBeDefined();
            expect(totalGames).toEqual(2);
        });
    });
    describe('getBonusData', () => {
        it('checks that the bonus data is correct with a 0 win 0 loss', async () => {
            const { asset } = await createRandomAsset(db);

            const bonusData = await algoNFTAssetRepo.getBonusData(asset, 1);
            expect(bonusData).toBeDefined();
            expect(bonusData).toEqual({
                assetRank: 0,
                assetTotalGames: 0,
                assetWins: 0,
                averageRank: 1,
                averageTotalAssets: 0,
                averageTotalGames: 0,
                averageWins: 0,
                userTotalAssets: 1,
            });
        });
        it('checks that the bonus data is correct 10 players', async () => {
            const assets = await Promise.all([...Array(10)].map(() => createRandomAsset(db)));
            await Promise.all([
                algoNFTAssetRepo.assetEndGameUpdate(assets[0].asset, 1, {
                    wins: 10,
                    losses: 5,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[1].asset, 1, {
                    wins: 10,
                    losses: 4,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[2].asset, 1, {
                    wins: 10,
                    losses: 3,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[3].asset, 1, {
                    wins: 10,
                    losses: 2,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[4].asset, 1, {
                    wins: 10,
                    losses: 0,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[5].asset, 1, {
                    wins: 5,
                    losses: 5,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[6].asset, 1, {
                    wins: 5,
                    losses: 4,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[7].asset, 1, {
                    wins: 2,
                    losses: 1,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[8].asset, 1, {
                    wins: 2,
                    losses: 0,
                    zen: 0,
                }),
                algoNFTAssetRepo.assetEndGameUpdate(assets[9].asset, 1, {
                    wins: 1,
                    losses: 1,
                    zen: 0,
                }),
            ]);
            const bonusData = await algoNFTAssetRepo.getBonusData(assets[0].asset, 1);
            expect(bonusData).toBeDefined();
            expect(bonusData).toEqual({
                averageTotalGames: 9,
                assetTotalGames: 15,
                averageWins: 7,
                assetWins: 10,
                averageRank: 6,
                assetRank: 5,
                averageTotalAssets: 0,
                userTotalAssets: 1,
            });
        });
    });
});
