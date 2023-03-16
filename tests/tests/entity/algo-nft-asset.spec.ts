import type { IndexerAssetResult } from '../../../src/model/types/algorand.js';
import { EntityManager, MikroORM } from '@mikro-orm/core';

import {
    AlgoNFTAsset,
    AlgoNFTAssetRepository,
} from '../../../src/entities/algo-nft-asset.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/algo-wallet.entity.js';
import { mockCustomCache } from '../../mocks/mock-custom-cache.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomAsset, createRandomUser, createRandomWallet } from '../../utils/test-funcs.js';

jest.mock('../../../src/services/custom-cache.js', () => ({
    CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let database: EntityManager;
    let algoNFTAssetRepo: AlgoNFTAssetRepository;
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
    });
    it('findById', async () => {
        const { asset } = await createRandomAsset(database);
        const assetFromDatabase = await algoNFTAssetRepo.findOne(asset.id);
        expect(assetFromDatabase).toBeDefined();
        expect(assetFromDatabase?.id).toEqual(asset.id);
    });
    it('getAllPlayerAssets', async () => {
        const { asset } = await createRandomAsset(database);

        const assetFromDatabase = await algoNFTAssetRepo.getAllRealWorldAssets();
        expect(assetFromDatabase).toBeDefined();
        expect(assetFromDatabase).toHaveLength(1);
        expect(assetFromDatabase[0].id).toEqual(asset.id);
        expect(assetFromDatabase[1]).toBeUndefined();
    });
    describe('anyAssetsUpdatedMoreThan24HoursAgo', () => {
        it('should return true', async () => {
            const { asset } = await createRandomAsset(database);

            const date = new Date();
            date.setHours(date.getHours() - 25);
            const schemaTableName = orm.getMetadata().get('AlgoNFTAsset').collection;
            const result = await database
                .getConnection()
                .execute(`UPDATE ${schemaTableName} SET "updated_at" = ? WHERE id = ?`, [
                    date,
                    asset.id,
                ]);
            expect(result).toHaveProperty('changes', 1);
            expect(result).toHaveProperty('lastInsertRowid', asset.id);
            const oldAsset = await algoNFTAssetRepo.anyAssetsUpdatedMoreThan24HoursAgo();
            expect(oldAsset).toBeTruthy();
        });
        it('should return false because it has been recently updated', async () => {
            await createRandomAsset(database);

            const assets = await algoNFTAssetRepo.anyAssetsUpdatedMoreThan24HoursAgo();
            expect(assets).toBeFalsy();
        });
        it('should return no wallets because it is a bot', async () => {
            const { asset } = await createRandomAsset(database);
            asset.id = 1;
            await algoNFTAssetRepo.persistAndFlush(asset);
            database = orm.em.fork();
            algoNFTAssetRepo = database.getRepository(AlgoNFTAsset);
            const date = new Date();
            date.setHours(date.getHours() - 25);
            const schemaTableName = orm.getMetadata().get('AlgoNFTAsset').collection;
            const result = await database
                .getConnection()
                .execute(`UPDATE ${schemaTableName} SET "updated_at" = ? WHERE id = ?`, [
                    date,
                    asset.id,
                ]);
            expect(result).toHaveProperty('changes', 1);
            const assets = await algoNFTAssetRepo.anyAssetsUpdatedMoreThan24HoursAgo();
            expect(assets).toBeFalsy();
        });
    });
    describe('getOwnerWalletFromAssetIndex', () => {
        it('(expect to throw error that owner wallet not found)', async () => {
            expect.assertions(2);
            const { asset } = await createRandomAsset(database);

            try {
                await algoNFTAssetRepo.getOwnerWalletFromAssetIndex(asset?.id);
            } catch (error) {
                expect(error).toBeDefined();
                expect(error).toHaveProperty('message', 'Owner wallet not found');
            }
        });
        it('(expect to throw error with no asset)', async () => {
            expect.assertions(2);
            try {
                await algoNFTAssetRepo.getOwnerWalletFromAssetIndex(55);
            } catch (error) {
                expect(error).toBeDefined();
                expect(error).toHaveProperty('message', 'AlgoNFTAsset not found ({ id: 55 })');
            }
        });
        it('expect to return owner wallet', async () => {
            const assetUser = await createRandomUser(database);
            const userWallet = await createRandomWallet(database, assetUser);
            const { asset: newAsset } = await createRandomAsset(database);
            userWallet.nft.add(newAsset);
            const algoWalletRepo = database.getRepository(AlgoWallet);
            await algoWalletRepo.flush();
            database = orm.em.fork();
            algoNFTAssetRepo = database.getRepository(AlgoNFTAsset);
            const wallet = await algoNFTAssetRepo.getOwnerWalletFromAssetIndex(newAsset.id);
            expect(wallet).toBeDefined();
        });
    });
    describe('addAssetsLookup', () => {
        it('adds assets from the algorand network', async () => {
            const algoAsset: IndexerAssetResult = {
                index: 123_456,
                'created-at-round': 1,
                'deleted-at-round': 0,
                params: {
                    creator: 'test',
                    total: 1,
                    decimals: 0,
                },
            };
            const { asset, creatorWallet } = await createRandomAsset(database);

            await algoNFTAssetRepo.addAssetsLookup(creatorWallet, [algoAsset]);
            const assetFromDatabase = await algoNFTAssetRepo.findOne(asset.id);
            expect(assetFromDatabase).toBeDefined();
            expect(assetFromDatabase?.id).toEqual(asset.id);
            expect(assetFromDatabase?.name).toEqual(asset.name);
            expect(assetFromDatabase?.unitName).toEqual(asset.unitName);
            expect(assetFromDatabase?.url).toEqual(asset.url);
        });
    });
    describe('assetEndGameUpdate', () => {
        it('checks that the end game update works as intended', async () => {
            const { asset } = await createRandomAsset(database);

            algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 1, losses: 0, zen: 0 });
            const assetFromDatabase = await algoNFTAssetRepo.findOne(asset.id);
            expect(assetFromDatabase).toBeDefined();
            expect(assetFromDatabase?.id).toEqual(asset.id);
            expect(assetFromDatabase?.dojoCoolDown).toBeInstanceOf(Date);
            expect(assetFromDatabase?.dojoWins).toEqual(1);
            expect(assetFromDatabase?.dojoLosses).toEqual(0);
            expect(assetFromDatabase?.dojoZen).toEqual(0);
        });
    });
    describe('zeroOutAssetCoolDown', () => {
        it('checks that the asset cooldown has been zeroed', async () => {
            const { asset } = await createRandomAsset(database);

            algoNFTAssetRepo.zeroOutAssetCooldown(asset);
            const assetFromDatabase = await algoNFTAssetRepo.findOne(asset.id);
            expect(assetFromDatabase).toBeDefined();
            expect(assetFromDatabase?.id).toEqual(asset.id);
            expect(assetFromDatabase?.dojoCoolDown).toEqual(new Date(0));
        });
    });

    describe('createNPCAsset', () => {
        let algoWallet: AlgoWalletRepository;
        let fakeWallet: AlgoWallet;
        const fakeAsset = {
            assetIndex: 123_456,
            name: 'Fake Asset',
            unitName: 'FAK',
            url: 'https://fakeasset.com',
        };

        beforeEach(async () => {
            const { creatorUser } = await createRandomAsset(database);

            algoWallet = database.getRepository(AlgoWallet);
            fakeWallet = new AlgoWallet('fake', creatorUser);
            await algoWallet.persistAndFlush(fakeWallet);
            algoWallet = database.getRepository(AlgoWallet);
        });
        it('creates a new asset if it does not exist', async () => {
            const result = await algoNFTAssetRepo.createNPCAsset(fakeWallet, fakeAsset);
            const assetFromDatabase = await algoNFTAssetRepo.findOne(fakeAsset.assetIndex);
            expect(result).toBeUndefined();
            expect(assetFromDatabase?.id).toEqual(fakeAsset.assetIndex);
            expect(assetFromDatabase?.name).toEqual(fakeAsset.name);
            expect(assetFromDatabase?.unitName).toEqual(fakeAsset.unitName);
            expect(assetFromDatabase?.url).toEqual(fakeAsset.url);
        });
        it('updates an existing asset if it already exists', async () => {
            // Create an asset with the given ID
            await algoNFTAssetRepo.createNPCAsset(fakeWallet, fakeAsset);

            // Call createNPCAsset with the same ID but different name, unitName, and URL
            const updatedAssetData = {
                assetIndex: 123_456,
                name: 'Updated Name',
                unitName: 'UPD',
                url: 'https://updatedasset.com',
            };
            const result = await algoNFTAssetRepo.createNPCAsset(fakeWallet, updatedAssetData);

            // Query the asset from the database and test that the updated values were saved correctly
            const assetFromDatabase = await algoNFTAssetRepo.findOne(updatedAssetData.assetIndex);
            expect(result).toBeUndefined();
            expect(assetFromDatabase?.id).toEqual(updatedAssetData.assetIndex);
            expect(assetFromDatabase?.name).toEqual(updatedAssetData.name);
            expect(assetFromDatabase?.unitName).toEqual(updatedAssetData.unitName);
            expect(assetFromDatabase?.url).toEqual(updatedAssetData.url);
        });
    });
    describe('assetRankingByWinsTotalGames', () => {
        it('checks that the asset ranking is correct with a 0 win 0 loss', async () => {
            await createRandomAsset(database);

            const ranking = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(0);
        });
        it('checks that the asset ranking is correct when only 1 asset has played a game.', async () => {
            const { asset } = await createRandomAsset(database);

            // update the first asset to have 1 win and 1 loss
            await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 0, losses: 1, zen: 0 });

            const ranking = await algoNFTAssetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(1);
            expect(ranking[0].id).toEqual(asset.id);
        });

        it('checks that the asset ranking is correct when 4 assets are created and 2 both have same wins but one has 0 losses', async () => {
            const { asset } = await createRandomAsset(database);

            // create 3 more assets
            const { asset: asset2 } = await createRandomAsset(database);
            const { asset: asset3 } = await createRandomAsset(database);
            const { asset: asset4 } = await createRandomAsset(database);
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
            const { asset } = await createRandomAsset(database);

            // create 3 more assets
            const { asset: asset2 } = await createRandomAsset(database);
            const { asset: asset3 } = await createRandomAsset(database);
            const { asset: asset4 } = await createRandomAsset(database);
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
            const { asset } = await createRandomAsset(database);

            const totalGames = algoNFTAssetRepo.assetTotalGames(asset);
            expect(totalGames).toBeDefined();
            expect(totalGames).toEqual(0);
        });
        it('checks that the asset total games is correct with a 1 win 1 loss', async () => {
            const { asset } = await createRandomAsset(database);

            await algoNFTAssetRepo.assetEndGameUpdate(asset, 1, { wins: 1, losses: 1, zen: 0 });
            const totalGames = algoNFTAssetRepo.assetTotalGames(asset);
            expect(totalGames).toBeDefined();
            expect(totalGames).toEqual(2);
        });
    });
    describe('getBonusData', () => {
        it('checks that the bonus data is correct with a 0 win 0 loss', async () => {
            const { asset } = await createRandomAsset(database);

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
            const assets = await Promise.all(
                Array.from({ length: 10 }).map(() => createRandomAsset(database))
            );
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
