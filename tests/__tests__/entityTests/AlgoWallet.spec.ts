import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';

import { AlgoNFTAsset } from '../../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { GameNPCs, InternalUserIDs } from '../../../src/enums/dtEnums.js';
import { initORM } from '../../utils/bootstrap.js';
import { createRandomUser, createRandomUserWithWalletAndAsset } from '../../utils/testFuncs.js';
jest.mock('axios');

jest.mock('../../../src/services/Algorand.js', () => ({
    Algorand: jest.fn().mockImplementation(() => ({
        creatorAssetSync: jest.fn(),
        // returns a mock random wallet
        createFakeWallet: jest.fn().mockReturnValue(Math.random().toString(36).substring(7)),
    })),
}));
describe('asset tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let user: User;
    let user2: User;
    let wallet: AlgoWallet;
    let asset: AlgoNFTAsset;
    let creatorWallet: AlgoWallet;
    let userRepo: UserRepository;
    let algoWallet: AlgoWalletRepository;
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
        user = await createRandomUser(db);
        const created = await createRandomUserWithWalletAndAsset(db);
        user2 = created.user;
        wallet = created.wallet;
        asset = created.asset.asset;
        creatorWallet = created.asset.creatorWallet;
        await userRepo.persistAndFlush(user);
    });
    describe('getAllWalletsByDiscordId', () => {
        it('should return no wallets', async () => {
            const wallets = await algoWallet.getAllWalletsByDiscordId(user.id);
            expect(wallets.length).toBe(0);
            expect(wallets).toEqual([]);
        });
        it('should return one wallet', async () => {
            const wallet = new AlgoWallet('123456', user);
            await algoWallet.persistAndFlush(wallet);
            const wallets = await algoWallet.getAllWalletsByDiscordId(user.id);
            expect(wallets.length).toBe(1);
        });
    });
    describe('getCreatorWallets', () => {
        it('should return no wallets', async () => {
            const wallets = await algoWallet.getCreatorWallets();
            expect(wallets.length).toBe(0);
            expect(wallets).toEqual([]);
        });
        it('should return one wallet', async () => {
            const creator = new User(InternalUserIDs.creator.toString());
            await userRepo.persistAndFlush(creator);
            const wallet = new AlgoWallet('123456', creator);
            await algoWallet.persistAndFlush(wallet);
            const wallets = await algoWallet.getCreatorWallets();
            expect(wallets.length).toBe(1);
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
            expect(algoNFTs.length).toBe(1);
            await algoWallet.removeCreatorWallet(creatorWallet.address);
            const wallets = await algoWallet.getCreatorWallets();
            expect(wallets.length).toBe(0);
            const algoNFTs2 = await algoNFTRepo.findAll();
            expect(algoNFTs2.length).toBe(0);
        });
    });
    describe('createNPCsIfNotExists', () => {
        it('should create 2 NPCs and 1 creator wallet', async () => {
            const createdNPCs = await algoWallet.createNPCsIfNotExists();
            // Check AlgoNFTAssets for the 2 NPCs
            const algoNFTRepo = db.getRepository(AlgoNFTAsset);
            const algoNFTs = await algoNFTRepo.findAll();
            // added one to the length because we have a user with an asset
            expect(algoNFTs.length).toBe(GameNPCs.length + 1);
            expect(createdNPCs).toBeTruthy();
            const wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets.length).toBe(1);
        });
        it('should not create bots if they are already created', async () => {
            let createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeTruthy();
            let wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets.length).toBe(1);

            createdNPCs = await algoWallet.createNPCsIfNotExists();
            expect(createdNPCs).toBeFalsy();
            wallets = await algoWallet.getAllWalletsByDiscordId(
                InternalUserIDs.botCreator.toString()
            );
            expect(wallets.length).toBe(1);
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
            expect(wallets.length).toBe(1);
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
            expect(wallets.length).toBe(1);
            expect(wallets[0].address).toBe(walletAddress);
        });
    });
    describe('Clearing the cool down for assets', () => {
        it('should clear a cooldown for one user', async () => {
            const assetCooldown = asset.dojoCoolDown;
            await algoWallet.clearAssetCoolDownsForUser(user2.id);
            expect(asset.dojoCoolDown.getTime()).toBeLessThan(assetCooldown.getTime());
        });
        it('should clear a cooldown for all users', async () => {
            const assetCooldown = asset.dojoCoolDown;
            await algoWallet.clearAssetCoolDownsForAllUsers();
            expect(asset.dojoCoolDown.getTime()).toBeLessThan(assetCooldown.getTime());
        });
        it('should clear the cooldown for a random asset for one user', async () => {
            const assetCooldown = asset.dojoCoolDown;
            await algoWallet.randomAssetCoolDownReset(user2.id, 1);
            expect(asset.dojoCoolDown.getTime()).toBeLessThan(assetCooldown.getTime());
            // should still work if you pick more assets than they own
            await algoWallet.randomAssetCoolDownReset(user2.id, 100);
            expect(asset.dojoCoolDown.getTime()).toBeLessThan(assetCooldown.getTime());
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
            const total = await algoWallet.getTotalAssetsByDiscordUser(user2.id);
            expect(total).toBe(1);
        });
    });
    describe('clearWalletAssets', () => {
        it('should clear all assets from a wallet', async () => {
            await algoWallet.clearWalletAssets(wallet.address);
            const total = await algoWallet.getTotalWalletAssets(wallet.address);
            expect(total).toBe(0);
        });
    });
    describe('lastUpdatedDate', () => {
        it('should return the last updated date', async () => {
            const lastUpdated = await algoWallet.lastUpdatedDate(user2.id);
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
});
