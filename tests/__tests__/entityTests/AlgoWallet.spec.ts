import { EntityManager, MikroORM } from '@mikro-orm/core';

import { AlgoNFTAsset } from '../../../src/entities/AlgoNFTAsset.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../src/entities/User.entity.js';
import { GameNPCs, InternalUserIDs } from '../../../src/enums/dtEnums.js';
import { initORM } from '../../utils/bootstrap.js';
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
        user = new User('123456');
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
            await algoWallet.addCreatorWallet('123456');
            await algoWallet.removeCreatorWallet('123456');
        });
    });
    describe('createNPCsIfNotExists', () => {
        it('should create 2 NPCs and 1 creator wallet', async () => {
            const createdNPCs = await algoWallet.createNPCsIfNotExists();
            // Check AlgoNFTAssets for the 2 NPCs
            const algoNFTRepo = db.getRepository(AlgoNFTAsset);
            const algoNFTs = await algoNFTRepo.findAll();
            expect(algoNFTs.length).toBe(GameNPCs.NPCs.length);
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
});
