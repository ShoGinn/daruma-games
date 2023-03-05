import { faker } from '@faker-js/faker';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';
import { inlineCode } from 'discord.js';

import { AlgoNFTAsset } from '../../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoStdAsset } from '../../../src/entities/AlgoStdAsset.entity.js';
import { AlgoStdToken, AlgoStdTokenRepository } from '../../../src/entities/AlgoStdToken.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { GameNPCs, InternalUserIDs } from '../../../src/enums/dtEnums.js';
import { AssetHolding } from '../../../src/model/types/algorand.js';
import { initORM } from '../../utils/bootstrap.js';
import {
    createRandomASA,
    createRandomUser,
    createRandomUserWithRandomWallet,
    createRandomUserWithWalletAndAsset,
    createRandomWallet,
} from '../../utils/testFuncs.js';
jest.mock('axios');

jest.mock('../../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        creatorAssetSync: jest.fn(),
        // returns a mock random wallet
        createFakeWallet: jest.fn().mockReturnValue(Math.random().toString(36).substring(7)),
        getAllStdAssets: jest.fn().mockReturnValue([]),
        getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: false, tokens: 10 }),
        lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
    })),
}));
describe('asset tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let user: User;
    let userWithAssetsAdded: User;
    let userWithNoToken: User;
    let wallet: AlgoWallet;
    let asset: AlgoNFTAsset;
    let stdAssetOptedIn: AlgoStdAsset;
    let stdAssetNotOptedIn: AlgoStdAsset;
    let stdAssetNoTokens: AlgoStdAsset;
    let creatorWallet: AlgoWallet;
    let userRepo: UserRepository;
    let algoWallet: AlgoWalletRepository;
    let tokenRepo: AlgoStdTokenRepository;
    let getTokenFromAlgoNetwork: jest.SpyInstance;

    beforeAll(async () => {
        orm = await initORM();
        db = orm.em.fork();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        algoWallet = db.getRepository(AlgoWallet);
        userRepo = db.getRepository(User);
        tokenRepo = db.getRepository(AlgoStdToken);
        user = await createRandomUser(db);
        const otherUser = await createRandomUserWithRandomWallet(db);
        userWithNoToken = otherUser.user;
        const created = await createRandomUserWithWalletAndAsset(db);
        userWithAssetsAdded = created.user;
        wallet = created.wallet;
        asset = created.asset.asset;
        creatorWallet = created.asset.creatorWallet;
        asset.dojoCoolDown = new Date('2025-01-01');
        stdAssetOptedIn = await createRandomASA(db);
        stdAssetNotOptedIn = await createRandomASA(db);

        getTokenFromAlgoNetwork = jest.spyOn(tokenRepo, 'getTokenFromAlgoNetwork');

        getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1000 });
        await tokenRepo.addAlgoStdToken(wallet, stdAssetOptedIn);

        getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: false, tokens: 0 });
        await tokenRepo.addAlgoStdToken(wallet, stdAssetNotOptedIn);

        db = orm.em.fork();
        algoWallet = db.getRepository(AlgoWallet);
        userRepo = db.getRepository(User);
        tokenRepo = db.getRepository(AlgoStdToken);
    });
    describe('anyWalletsUpdatedMoreThan24HoursAgo', () => {
        it('should return no wallets', async () => {
            const wallets = await algoWallet.anyWalletsUpdatedMoreThan24HoursAgo();
            expect(wallets).toBeFalsy();
        });
        it('should return one wallet', async () => {
            const date = new Date();
            date.setHours(date.getHours() - 25);
            const schemaTableName = orm.getMetadata().get('AlgoWallet').collection;
            await db
                .getConnection()
                .execute(`UPDATE ${schemaTableName} SET "updated_at" = ? WHERE address = ?`, [
                    date,
                    wallet.address,
                ]);
            const wallets = await algoWallet.anyWalletsUpdatedMoreThan24HoursAgo();
            expect(wallets).toBeTruthy();
        });
        it('should return no wallets because it is a bot', async () => {
            const date = new Date();
            date.setHours(date.getHours() - 25);
            const botUser = await createRandomUser(db, InternalUserIDs.botCreator.toString());
            const botWallet = await createRandomWallet(db, botUser);
            const schemaTableName = orm.getMetadata().get('AlgoWallet').collection;
            await db
                .getConnection()
                .execute(`UPDATE ${schemaTableName} SET "updated_at" = ? WHERE address = ?`, [
                    date,
                    botWallet.address,
                ]);
            const wallets = await algoWallet.anyWalletsUpdatedMoreThan24HoursAgo();
            expect(wallets).toBeFalsy();
        });
    });
    describe('getAllWalletsByDiscordId', () => {
        it('should return no wallets', async () => {
            const wallets = await algoWallet.getAllWalletsByDiscordId(user.id);
            expect(wallets).toHaveLength(0);
            expect(wallets).toEqual([]);
        });
        it('should return one wallet', async () => {
            const wallet = new AlgoWallet('123456', user);
            await algoWallet.persistAndFlush(wallet);
            const wallets = await algoWallet.getAllWalletsByDiscordId(user.id);
            expect(wallets).toHaveLength(1);
        });
    });
    describe('getCreatorWallets', () => {
        it('should return no wallets', async () => {
            const wallets = await algoWallet.getCreatorWallets();
            expect(wallets).toHaveLength(0);
            expect(wallets).toEqual([]);
        });
        it('should return one wallet', async () => {
            const creator = new User(InternalUserIDs.creator.toString());
            await userRepo.persistAndFlush(creator);
            const wallet = new AlgoWallet('123456', creator);
            await algoWallet.persistAndFlush(wallet);
            const wallets = await algoWallet.getCreatorWallets();
            expect(wallets).toHaveLength(1);
        });
    });
    describe('addCreatorWallet', () => {
        it('should not return a wallet', async () => {
            const wallet = await algoWallet.addCreatorWallet('123456');
            expect(wallet).toBeInstanceOf(AlgoWallet);
            expect(wallet?.owner.id).toBe(InternalUserIDs.creator.toString());
            const wallet2 = await algoWallet.addCreatorWallet('123456');
            expect(wallet2).toBeNull();
        });
        it('should add a wallet', async () => {
            const wallet = await algoWallet.addCreatorWallet('123456');
            expect(wallet).toBeInstanceOf(AlgoWallet);
            expect(wallet?.owner.id).toBe(InternalUserIDs.creator.toString());
        });
    });
    describe('removeCreatorWallet', () => {
        it('should throw an error because wallet does not exist', async () => {
            expect.assertions(1);
            try {
                await algoWallet.removeCreatorWallet('123456');
            } catch (e) {
                expect(e).toMatchObject({
                    // eslint-disable-next-line quotes
                    message: "AlgoWallet not found ({ address: '123456' })",
                });
            }
        });
        it('should remove a wallet', async () => {
            // get a count of assets
            const algoNFTRepo = db.getRepository(AlgoNFTAsset);
            const algoNFTs = await algoNFTRepo.findAll();
            expect(algoNFTs).toHaveLength(1);
            await algoWallet.removeCreatorWallet(creatorWallet.address);
            const wallets = await algoWallet.getCreatorWallets();
            expect(wallets).toHaveLength(0);
            const algoNFTs2 = await algoNFTRepo.findAll();
            expect(algoNFTs2).toHaveLength(0);
        });
    });
    describe('createNPCsIfNotExists', () => {
        it('should create 2 NPCs and 1 creator wallet', async () => {
            const createdNPCs = await algoWallet.createNPCsIfNotExists();
            // Check AlgoNFTAssets for the 2 NPCs
            const algoNFTRepo = db.getRepository(AlgoNFTAsset);
            const algoNFTs = await algoNFTRepo.findAll();
            // added one to the length because we have a user with an asset
            expect(algoNFTs).toHaveLength(GameNPCs.length + 1);
            expect(createdNPCs).toBeTruthy();
            const wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets).toHaveLength(1);
        });
        it('should not create bots if they are already created', async () => {
            let createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeTruthy();
            let wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets).toHaveLength(1);

            createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeFalsy();
            wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets).toHaveLength(1);
        });
        it('should delete wallets if creator wallet exists and no NPCs exist', async () => {
            let createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeTruthy();
            let wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            const walletAddress = wallets[0].address;
            // Delete all NPCs
            const algoNFTRepo = db.getRepository(AlgoNFTAsset);
            const algoNFTs = await algoNFTRepo.findAll();
            await algoNFTRepo.removeAndFlush(algoNFTs);
            createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeTruthy();
            wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets).toHaveLength(1);
            expect(wallets[0].address).not.toBe(walletAddress);
        });
        it('should not delete wallets if creator wallet exists and NPCs exist', async () => {
            let createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeTruthy();
            let wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            const walletAddress = wallets[0].address;
            createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeFalsy();
            wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets).toHaveLength(1);
            expect(wallets[0].address).toBe(walletAddress);
        });
    });
    describe('Clearing the cool down for assets', () => {
        it('should clear a cooldown for one user', async () => {
            // fetch the original asset from the database and save its cooldown date in a variable
            const oldAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: asset.id });
            const originalCooldown = oldAsset.dojoCoolDown;

            // clear the cooldown for the user
            await algoWallet.clearAssetCoolDownsForUser(userWithAssetsAdded.id);

            // fetch the asset from the database again to get the updated cooldown date
            const newAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: asset.id });

            // assert that the new cooldown date is earlier than the original cooldown date
            expect(newAsset.dojoCoolDown.getTime()).toBeLessThan(originalCooldown.getTime());
        });
        it('should clear a cooldown for all users', async () => {
            // fetch the original asset from the database and save its cooldown date in a variable
            const oldAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: asset.id });
            const originalCooldown = oldAsset.dojoCoolDown;

            // clear the cooldown for the user
            await algoWallet.clearAssetCoolDownsForAllUsers();

            // fetch the asset from the database again to get the updated cooldown date
            const newAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: asset.id });

            // assert that the new cooldown date is earlier than the original cooldown date
            expect(newAsset.dojoCoolDown.getTime()).toBeLessThan(originalCooldown.getTime());
        });
        it('should clear the cooldown for a random asset for one user', async () => {
            // fetch the original asset from the database and save its cooldown date in a variable
            const oldAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: asset.id });
            const originalCooldown = oldAsset.dojoCoolDown;

            // clear the cooldown for the user
            await algoWallet.randomAssetCoolDownReset(userWithAssetsAdded.id, 100);

            // fetch the asset from the database again to get the updated cooldown date
            const newAsset = await db.getRepository(AlgoNFTAsset).findOneOrFail({ id: asset.id });

            // assert that the new cooldown date is earlier than the original cooldown date
            expect(newAsset.dojoCoolDown.getTime()).toBeLessThan(originalCooldown.getTime());
        });
    });
    describe('getTotalWalletAssets', () => {
        it('should return the total number of assets', async () => {
            const total = await algoWallet.getTotalWalletAssets(wallet.address);
            expect(total).toBe(1);
        });
    });
    describe('getTotalWalletAssetsByDiscordId', () => {
        it('should return the total number of assets', async () => {
            const total = await algoWallet.getTotalAssetsByDiscordUser(userWithAssetsAdded.id);
            expect(total).toBe(1);
        });
    });
    describe('clearWalletAssets', () => {
        it('should clear all assets from a wallet', async () => {
            const walletEntity = await algoWallet.clearWalletAssets(wallet.address);
            expect(walletEntity.nft).toHaveLength(0);
            const total = await algoWallet.getTotalWalletAssets(wallet.address);
            expect(total).toBe(0);
        });
    });
    describe('lastUpdatedDate', () => {
        it('should return the last updated date', async () => {
            const lastUpdated = await algoWallet.lastUpdatedDate(userWithAssetsAdded.id);
            expect(lastUpdated).toBeInstanceOf(Date);
        });
    });
    describe('getRandomImageUrl', () => {
        it('should return a random image url', async () => {
            let mockRequest: jest.Mock;
            let mockHead: jest.Mock;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mockAxios as any).head = mockHead = jest.fn();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mockAxios as any).get = mockRequest = jest.fn();
            mockRequest.mockResolvedValue({ data: [] });
            mockHead.mockResolvedValue({ status: 200 });
            const imageUrl = await algoWallet.getRandomImageUrl(wallet.address);
            expect(imageUrl).toBe(asset.url);
        });
    });
    describe('getWalletTokens', () => {
        it('should return the wallet tokens', async () => {
            const tokens = await algoWallet.getTokensAddedToWallet(wallet.address);
            expect(tokens).toHaveLength(2);
        });
    });
    describe('getWalletStdAsset', () => {
        it('should return the wallet standard assets', async () => {
            const assets = await algoWallet.getWalletStdAsset(wallet.address, stdAssetOptedIn.id);
            expect(assets).toHaveProperty('id', stdAssetOptedIn.id);
        });
        it('should return undefined if the wallet does not have the asset', async () => {
            const assets = await algoWallet.getWalletStdAsset(wallet.address, 123);
            expect(assets).toBeNull();
        });
    });
    describe('allWalletsOptedIn', () => {
        it('should return true if all wallets are opted in', async () => {
            const optedIn = await algoWallet.allWalletsOptedIn(
                userWithAssetsAdded.id,
                stdAssetOptedIn
            );
            expect(optedIn.walletWithMostTokens.address).toBe(wallet.address);
            expect(optedIn.optedInWallets).toHaveLength(1);
            expect(optedIn.optedInWallets[0].address).toBe(wallet.address);
            expect(optedIn.unclaimedTokens).toBe(0);
        });
        it('should return all negative if wallets are not opted in', async () => {
            const optedIn = await algoWallet.allWalletsOptedIn(
                userWithAssetsAdded.id,
                stdAssetNotOptedIn
            );
            expect(optedIn.optedInWallets).toHaveLength(0);
            expect(optedIn.unclaimedTokens).toBe(0);
            expect(optedIn.walletWithMostTokens).toBeUndefined();
        });
        it('should not return anything is tokens are missing', async () => {
            const optedIn = await algoWallet.allWalletsOptedIn(
                userWithNoToken.id,
                stdAssetNoTokens
            );
            expect(optedIn.optedInWallets).toHaveLength(0);
            expect(optedIn.unclaimedTokens).toBe(0);
            expect(optedIn.walletWithMostTokens).toBeUndefined();
        });
    });
    describe('generateStringFromAlgoStdAssetAddedArray', () => {
        it('should return a string of asset ids', () => {
            const mockReply = {
                id: faker.datatype.number(),
                name: faker.name.firstName(),
                optedIn: faker.datatype.boolean(),
                tokens: faker.datatype.number(),
            };
            const assets = algoWallet.generateStringFromAlgoStdAssetAddedArray([mockReply]);
            expect(assets).toBe(
                inlineCode(
                    `Name: ${
                        mockReply.name
                    } -- Tokens: ${mockReply.tokens.toLocaleString()} -- Opted-In: ${
                        mockReply.optedIn
                    }`
                )
            );
        });
    });
    describe('addAllAlgoStdAssetFromDB', () => {
        it('should add all std assets from the database', async () => {
            const newWallet = await createRandomUserWithRandomWallet(db);
            const assets = await algoWallet.addAllAlgoStdAssetFromDB(newWallet.wallet.address);
            expect(assets).toHaveLength(2);
            const getAsset1 = await algoWallet.getWalletStdAsset(
                newWallet.wallet.address,
                stdAssetNotOptedIn.id
            );
            expect(getAsset1).toHaveProperty('id', stdAssetNotOptedIn.id);
            const getAsset2 = await algoWallet.getWalletStdAsset(
                newWallet.wallet.address,
                stdAssetOptedIn.id
            );
            expect(getAsset2).toHaveProperty('id', stdAssetOptedIn.id);
        });
    });
    describe('addWalletAssets', () => {
        it('should return -1 because of the problem', async () => {
            const result = await algoWallet.addWalletAssets('12345', []);
            expect(result).toBe(-1);
        });

        it('should add assets to a wallet', async () => {
            const blankAsset: AssetHolding = {
                amount: 1,
                'asset-id': asset.id,
                'is-frozen': false,
            };
            const assets = await algoWallet.addWalletAssets(wallet.address, [blankAsset]);
            expect(assets).toBe(1);
        });
        it('should not add assets to a wallet because amount is 0', async () => {
            const blankAsset: AssetHolding = {
                amount: 0,
                'asset-id': asset.id,
                'is-frozen': false,
            };
            const assets = await algoWallet.addWalletAssets(wallet.address, [blankAsset]);
            expect(assets).toBe(0);
        });
        it('should not add assets to a wallet because asset-id does not match', async () => {
            const blankAsset: AssetHolding = {
                amount: 1,
                'asset-id': asset.id + 1,
                'is-frozen': false,
            };
            const assets = await algoWallet.addWalletAssets(wallet.address, [blankAsset]);
            expect(assets).toBe(0);
        });
    });
    describe('addAllAssetsToWallet', () => {
        it('should add all assets to a wallet', async () => {
            const newWallet = await createRandomUserWithRandomWallet(db);
            const assets = await algoWallet.addAllAssetsToWallet(newWallet.wallet.address);
            expect(assets.asaAssetsString.includes('Tokens: 10'));
            expect(assets.numberOfNFTAssetsAdded).toBe(0);
        });
    });
});
