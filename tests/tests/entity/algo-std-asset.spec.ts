import type { AssetLookupResult } from '../../../src/model/types/algorand.js';
import { EntityManager, MikroORM } from '@mikro-orm/core';

import {
    AlgoStdAsset,
    AlgoStdAssetRepository,
} from '../../../src/entities/algo-std-asset.entity.js';
import { initORM } from '../../utils/bootstrap.js';

describe('asset tests that require db', () => {
    let stdAsset: AssetLookupResult;

    let orm: MikroORM;
    let database: EntityManager;
    let asaRepo: AlgoStdAssetRepository;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        database = orm.em.fork();
        asaRepo = database.getRepository(AlgoStdAsset);
        stdAsset = {
            'current-round': '1',
            asset: {
                index: 1,
                'created-at-round': 1,
                'deleted-at-round': 0,
                params: {
                    name: 'name-ASA',
                    'unit-name': 'unit-name-ASA',
                    creator: 'creator',
                    decimals: 0,
                    total: 1,
                },
            },
        };
    });

    describe('addAlgoStdAsset', () => {
        it('should add an asset to the database', async () => {
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            let asset = await asaRepo.getStdAssetByAssetIndex(1);
            asset = await asaRepo.getStdAssetByUnitName('unit-name-ASA');
            expect(asset).not.toBeUndefined();
            expect(asset?.decimals).toBe(0);
            expect(asset?.id).toBe(1);
            expect(asset?.name).toBe('name-ASA');
            expect(asset?.unitName).toBe('unit-name-ASA');
            expect(asset?.url).toBe(' ');
        });
        it('should add an asset to the database that only had the asset.id', async () => {
            // clear out the asset params
            stdAsset.asset.params = {
                creator: 'creator',
                decimals: 0,
                total: 1,
            };
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            let asset = await asaRepo.getStdAssetByAssetIndex(1);
            asset = await asaRepo.getStdAssetByUnitName(' ');
            expect(asset).not.toBeUndefined();
            expect(asset?.decimals).toBe(0);
            expect(asset?.id).toBe(1);
            expect(asset?.name).toBe(' ');
            expect(asset?.unitName).toBe(' ');
            expect(asset?.url).toBe(' ');
        });

        it('should add an asset with a different index but same unit name', async () => {
            expect.assertions(3);
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            stdAsset.asset.index = 2;
            try {
                expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            } catch (error) {
                expect(error).toMatchObject({
                    message: 'An asset with the same unit name already exists',
                });
            }
            try {
                await asaRepo.getStdAssetByAssetIndex(2);
            } catch (error) {
                expect(error).toMatchObject({ message: 'AlgoStdAsset not found ({ id: 2 })' });
            }
        });
        it('should add an asset and not allow for duplicate asset id', async () => {
            stdAsset.asset.index = 2;
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            // should not add the same asset twice
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeFalsy();
            const asset = await asaRepo.getStdAssetByAssetIndex(2);
            expect(asset).not.toBeUndefined();
        });
        it('should add an asset with a decimal higher than 0 less than 20', async () => {
            const stdAssetWithBigDecimals = stdAsset;
            // set the decimals to a BigInt
            stdAssetWithBigDecimals.asset.params.decimals = 19;
            stdAssetWithBigDecimals.asset.params.total = 100_000_000_000_000_000n;
            stdAssetWithBigDecimals.asset.index = 3;

            expect(await asaRepo.addAlgoStdAsset(stdAssetWithBigDecimals)).toBeTruthy();
            const asset = await asaRepo.getStdAssetByAssetIndex(3);
            expect(asset).not.toBeUndefined();
            expect(asset?.decimals).toEqual(19);
            expect(asset?.id).toEqual(3);
            expect(stdAssetWithBigDecimals.asset.params.total).toEqual(100_000_000_000_000_000n);
            expect(typeof stdAssetWithBigDecimals.asset.params.total).toEqual('bigint');
        });
        it('should add an asset with a decimal higher than 19 and throw an error', async () => {
            expect.assertions(2);

            const stdAssetWithBigDecimals = stdAsset;
            // set the decimals to a BigInt
            stdAssetWithBigDecimals.asset.params.decimals = 20;
            try {
                await asaRepo.addAlgoStdAsset(stdAssetWithBigDecimals);
            } catch (error) {
                expect(error).toMatchObject({
                    message: 'Invalid decimals value for asset must be between 0 and 19',
                });
            }

            stdAssetWithBigDecimals.asset.params.decimals = -1;
            try {
                await asaRepo.addAlgoStdAsset(stdAssetWithBigDecimals);
            } catch (error) {
                expect(error).toMatchObject({
                    message: 'Invalid decimals value for asset must be between 0 and 19',
                });
            }
        });
        it('should find all assets in the database and be only 1', async () => {
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            const assets = await asaRepo.getAllStdAssets();
            expect(assets).toHaveLength(1);
        });
        it('create an asset then delete it', async () => {
            expect.assertions(5);
            expect(await asaRepo.addAlgoStdAsset(stdAsset)).toBeTruthy();
            let asset = await asaRepo.getStdAssetByAssetIndex(1);
            expect(asset).not.toBeUndefined();

            await asaRepo.deleteStdAsset(1);
            try {
                asset = await asaRepo.getStdAssetByAssetIndex(1);
            } catch (error) {
                expect(error).not.toBeUndefined();
                expect(error).toMatchObject({ message: 'AlgoStdAsset not found ({ id: 1 })' });
            }
            expect(asset).not.toBeUndefined();
        });
    });
});
