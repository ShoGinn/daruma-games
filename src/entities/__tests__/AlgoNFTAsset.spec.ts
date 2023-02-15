import { EntityManager, MikroORM } from '@mikro-orm/core';

import { initORM } from '../../tests/utils/bootstrap.js';
import { mockCustomCache } from '../../tests/utils/mockCustomCache.js';
import { AlgoNFTAsset, AlgoNFTAssetRepository } from '../AlgoNFTAsset.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../AlgoWallet.entity.js';
import { User, UserRepository } from '../User.entity.js';
jest.mock('../../services/CustomCache', () => ({
    CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
}));

describe('asset tests that require db', () => {
    let orm: MikroORM;
    let user: User;
    let asset: AlgoNFTAsset;
    let db: EntityManager;
    let assetRepo: AlgoNFTAssetRepository;
    let userRepo: UserRepository;
    let creatorWallet: AlgoWallet;
    async function createAssetFunc(): Promise<Record<string, any>> {
        const userID = Math.random().toString(36).substring(7);
        const walletAddress = Math.random().toString(36).substring(7);
        const assetIndex = Math.floor(Math.random() * 100000);
        const user = new User();
        // random id string to avoid conflicts
        user.id = userID;
        await userRepo.persistAndFlush(user);
        const creatorWallet = new AlgoWallet(walletAddress, user);
        const asset = new AlgoNFTAsset(assetIndex, creatorWallet, 'test', 'test', 'test');
        await db.getRepository(AlgoNFTAsset).persistAndFlush(asset);
        return { user, userID, walletAddress, asset, creatorWallet };
    }
    async function createAsset(): Promise<void> {
        const {
            user: user2,
            asset: asset2,
            creatorWallet: creatorWallet2,
        } = await createAssetFunc();
        user = user2;
        asset = asset2;
        creatorWallet = creatorWallet2;
    }
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
        assetRepo = db.getRepository(AlgoNFTAsset);
    });
    it('findById', async () => {
        await createAsset();
        const assetFromDb = await assetRepo.findOne(asset.id);
        expect(assetFromDb).toBeDefined();
        expect(assetFromDb?.id).toEqual(asset.id);
    });
    it('getAllPlayerAssets', async () => {
        await createAsset();
        const assetFromDb = await assetRepo.getAllPlayerAssets();
        expect(assetFromDb).toBeDefined();
        expect(assetFromDb).toHaveLength(1);
        expect(assetFromDb[0].id).toEqual(asset.id);
        expect(assetFromDb[1]).toBeUndefined();
    });
    describe('getOwnerWalletFromAssetIndex', () => {
        it('(expect to throw error that owner wallet not found)', async () => {
            await createAsset();
            try {
                await assetRepo.getOwnerWalletFromAssetIndex(asset?.id);
            } catch (e) {
                expect(e).toBeDefined();
                expect(e).toHaveProperty('message', 'Owner wallet not found');
            }
        });
        it('(expect to throw error with no asset)', async () => {
            try {
                await assetRepo.getOwnerWalletFromAssetIndex(55);
            } catch (e) {
                expect(e).toBeDefined();
                expect(e).toHaveProperty('message', 'Asset not found');
            }
        });
    });
    describe('addAssetsLookup', () => {
        it('adds assets from the algorand network', async () => {
            const algoAsset: AlgorandPlugin.AssetResult = {
                index: 123456,
                'created-at-round': 1,
                'deleted-at-round': 0,
                params: {
                    creator: 'test',
                    total: 1,
                    decimals: 0,
                },
            };
            await createAsset();
            await assetRepo.addAssetsLookup(creatorWallet, [algoAsset]);
            const assetFromDb = await assetRepo.findOne(asset.id);
            expect(assetFromDb).toBeDefined();
            expect(assetFromDb?.id).toEqual(asset.id);
            expect(assetFromDb?.name).toEqual(asset.name);
            expect(assetFromDb?.unitName).toEqual(asset.unitName);
            expect(assetFromDb?.url).toEqual(asset.url);
        });
    });
    describe('assetEndGameUpdate', () => {
        it('checks that the end game update works as intended', async () => {
            await createAsset();
            assetRepo.assetEndGameUpdate(asset, 1, { wins: 1, losses: 0, zen: 0 });
            const assetFromDb = await assetRepo.findOne(asset.id);
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
            await createAsset();
            assetRepo.zeroOutAssetCooldown(asset);
            const assetFromDb = await assetRepo.findOne(asset.id);
            expect(assetFromDb).toBeDefined();
            expect(assetFromDb?.id).toEqual(asset.id);
            expect(assetFromDb?.dojoCoolDown).toEqual(new Date(0));
        });
    });

    describe('createNPCAsset', () => {
        let algoWallet: AlgoWalletRepository;
        let fakeWallet: AlgoWallet;
        beforeEach(async () => {
            await createAsset();
            algoWallet = db.getRepository(AlgoWallet);
            fakeWallet = new AlgoWallet('fake', user);
            await algoWallet.persistAndFlush(fakeWallet);
        });
        it('creates a new asset if it does not exist', async () => {
            const fakeAsset = {
                assetIndex: 123456,
                name: 'Fake Asset',
                unitName: 'FAK',
                url: 'https://fakeasset.com',
            };
            const result = await assetRepo.createNPCAsset(fakeWallet, fakeAsset);
            const assetFromDb = await assetRepo.findOne(fakeAsset.assetIndex);
            expect(result).toBeUndefined();
            expect(assetFromDb?.id).toEqual(fakeAsset.assetIndex);
            expect(assetFromDb?.name).toEqual(fakeAsset.name);
            expect(assetFromDb?.unitName).toEqual(fakeAsset.unitName);
            expect(assetFromDb?.url).toEqual(fakeAsset.url);
        });
        it('updates an existing asset if it already exists', async () => {
            // Create an asset with the given ID
            const fakeAsset = {
                assetIndex: 123456,
                name: 'Fake Asset',
                unitName: 'FAK',
                url: 'https://fakeasset.com',
            };
            await assetRepo.createNPCAsset(fakeWallet, fakeAsset);

            // Call createNPCAsset with the same ID but different name, unitName, and URL
            const updatedAssetData = {
                assetIndex: 123456,
                name: 'Updated Name',
                unitName: 'UPD',
                url: 'https://updatedasset.com',
            };
            const result = await assetRepo.createNPCAsset(fakeWallet, updatedAssetData);

            // Query the asset from the database and test that the updated values were saved correctly
            const assetFromDb = await assetRepo.findOne(updatedAssetData.assetIndex);
            expect(result).toBeUndefined();
            expect(assetFromDb?.id).toEqual(updatedAssetData.assetIndex);
            expect(assetFromDb?.name).toEqual(updatedAssetData.name);
            expect(assetFromDb?.unitName).toEqual(updatedAssetData.unitName);
            expect(assetFromDb?.url).toEqual(updatedAssetData.url);
        });
    });
    describe('assetRankingByWinsTotalGames', () => {
        it('checks that the asset ranking is correct with a 0 win 0 loss', async () => {
            await createAsset();
            const ranking = await assetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(0);
        });
        it('checks that the asset ranking is correct when 4 assets are created and 2 both have same wins but one has 0 losses', async () => {
            await createAsset();
            // create 3 more assets
            const { asset: asset2 } = await createAssetFunc();
            const { asset: asset3 } = await createAssetFunc();
            const { asset: asset4 } = await createAssetFunc();
            // update the first asset to have 1 win and 1 loss
            await assetRepo.assetEndGameUpdate(asset, 1, { wins: 5, losses: 1, zen: 0 });
            // update the second asset to have 1 win and 0 losses
            await assetRepo.assetEndGameUpdate(asset2, 1, { wins: 3, losses: 1, zen: 0 });
            // update the third asset to have 0 wins and 1 loss
            await assetRepo.assetEndGameUpdate(asset3, 1, { wins: 2, losses: 0, zen: 0 });
            // update the fourth asset to have 0 wins and 0 losses
            await assetRepo.assetEndGameUpdate(asset4, 1, { wins: 2, losses: 1, zen: 0 });

            const ranking = await assetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(4);
            expect(ranking[0].id).toEqual(asset.id);
            expect(ranking[1].id).toEqual(asset2.id);
            expect(ranking[2].id).toEqual(asset3.id);
            expect(ranking[3].id).toEqual(asset4.id);
        });

        it('checks that the asset ranking is correct when 4 assets are created and one has no wins', async () => {
            await createAsset();
            // create 3 more assets
            const { asset: asset2 } = await createAssetFunc();
            const { asset: asset3 } = await createAssetFunc();
            const { asset: asset4 } = await createAssetFunc();
            // update the first asset to have 1 win and 1 loss
            await assetRepo.assetEndGameUpdate(asset, 1, { wins: 5, losses: 1, zen: 0 });
            // update the second asset to have 1 win and 0 losses
            await assetRepo.assetEndGameUpdate(asset2, 1, { wins: 3, losses: 1, zen: 0 });
            // update the third asset to have 0 wins and 1 loss
            await assetRepo.assetEndGameUpdate(asset3, 1, { wins: 2, losses: 1, zen: 0 });
            // update the fourth asset to have 0 wins and 0 losses
            await assetRepo.assetEndGameUpdate(asset4, 1, { wins: 0, losses: 0, zen: 0 });

            const ranking = await assetRepo.assetRankingByWinsTotalGames();
            expect(ranking).toBeDefined();
            expect(ranking).toHaveLength(3);
            expect(ranking[0].id).toEqual(asset.id);
            expect(ranking[1].id).toEqual(asset2.id);
            expect(ranking[2].id).toEqual(asset3.id);
        });
    });
    describe('assetTotalGames', () => {
        it('checks that the asset total games is correct with a 0 win 0 loss', async () => {
            await createAsset();
            const totalGames = await assetRepo.assetTotalGames(asset);
            expect(totalGames).toBeDefined();
            expect(totalGames).toEqual(0);
        });
        it('checks that the asset total games is correct with a 1 win 1 loss', async () => {
            await createAsset();
            await assetRepo.assetEndGameUpdate(asset, 1, { wins: 1, losses: 1, zen: 0 });
            const totalGames = await assetRepo.assetTotalGames(asset);
            expect(totalGames).toBeDefined();
            expect(totalGames).toEqual(2);
        });
    });
    describe('getBonusData', () => {
        it('checks that the bonus data is correct with a 0 win 0 loss', async () => {
            await createAsset();
            const bonusData = await assetRepo.getBonusData(asset, 1);
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
            await createAsset();
            // create 9 more assets
            const { asset: asset2 } = await createAssetFunc();
            const { asset: asset3 } = await createAssetFunc();
            const { asset: asset4 } = await createAssetFunc();
            const { asset: asset5 } = await createAssetFunc();
            const { asset: asset6 } = await createAssetFunc();
            const { asset: asset7 } = await createAssetFunc();
            const { asset: asset8 } = await createAssetFunc();
            const { asset: asset9 } = await createAssetFunc();
            const { asset: asset10 } = await createAssetFunc();
            await assetRepo.assetEndGameUpdate(asset, 1, { wins: 10, losses: 5, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset2, 1, { wins: 10, losses: 4, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset3, 1, { wins: 10, losses: 3, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset4, 1, { wins: 10, losses: 2, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset5, 1, { wins: 10, losses: 0, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset6, 1, { wins: 5, losses: 5, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset7, 1, { wins: 5, losses: 4, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset8, 1, { wins: 2, losses: 1, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset9, 1, { wins: 2, losses: 0, zen: 0 });
            await assetRepo.assetEndGameUpdate(asset10, 1, { wins: 1, losses: 1, zen: 0 });
            //!TODO need to add and verify this test!
            const bonusData = await assetRepo.getBonusData(asset, 1);
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