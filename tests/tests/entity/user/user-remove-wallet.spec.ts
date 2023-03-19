import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';

import { AlgoStdToken } from '../../../../src/entities/algo-std-token.entity.js';
import { AlgoWallet, AlgoWalletRepository } from '../../../../src/entities/algo-wallet.entity.js';
import { User, UserRepository } from '../../../../src/entities/user.entity.js';
import { initORM } from '../../../utils/bootstrap.js';
import {
    addRandomAssetAndWalletToUser,
    createRandomASA,
    createRandomUser,
    createRandomUserWithRandomWallet,
} from '../../../utils/test-funcs.js';
jest.mock('axios');

describe('User tests that require db', () => {
    let orm: MikroORM;
    let database: EntityManager;
    let userRepo: UserRepository;
    let algoWalletRepo: AlgoWalletRepository;
    let user: User;
    let mockRequest: jest.Mock;

    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        database = orm.em.fork();
        userRepo = database.getRepository(User);
        algoWalletRepo = database.getRepository(AlgoWallet);
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
        user = await createRandomUser(database);
    });
    describe('removeWalletFromUser', () => {
        let wallet: AlgoWallet;
        let wallet2: AlgoWallet;
        beforeEach(async () => {
            const firstUser = await createRandomUserWithRandomWallet(database);
            user = firstUser.user;
            wallet = firstUser.wallet;
            const secondUser = await createRandomUserWithRandomWallet(database);
            wallet2 = secondUser.wallet;
            mockRequest.mockResolvedValue({ data: [] });
        });

        it('should not remove the wallet', async () => {
            // act
            let allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(2);

            const result = await userRepo.removeWalletFromUser(user.id, wallet2.address);

            allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(2);

            // assert
            expect(result.includes('You do not')).toBeTruthy();
        });
        it('should remove the wallet', async () => {
            let allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(2);

            // act
            const result = await userRepo.removeWalletFromUser(user.id, wallet.address);

            allWallets = await algoWalletRepo.findAll();
            expect(allWallets).toHaveLength(1);

            // assert
            expect(result.includes('removed')).toBeTruthy();
        });
        it('should remove the wallet even if the user has multiple wallets', async () => {
            let ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            let allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets).toHaveLength(1);

            const { wallet: userWallet2 } = await addRandomAssetAndWalletToUser(database, user);
            const { wallet: userWallet3 } = await addRandomAssetAndWalletToUser(database, user);

            let databaseWallets = await algoWalletRepo.findAll();
            // its 6 because of the assets
            expect(databaseWallets).toHaveLength(6);

            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            expect(allWallets).toHaveLength(3);

            // act
            const result = await userRepo.removeWalletFromUser(user.id, userWallet2.address);
            expect(result.includes('removed')).toBeTruthy();
            expect(result.includes(userWallet2.address)).toBeTruthy();
            databaseWallets = await algoWalletRepo.findAll();
            // its 6 because of the assets
            expect(databaseWallets).toHaveLength(5);
            database = orm.em.fork();
            userRepo = database.getRepository(User);
            algoWalletRepo = database.getRepository(AlgoWallet);

            ownerWallets = await userRepo.findByDiscordIDWithWallets(user.id);
            allWallets = ownerWallets?.algoWallets.getItems();
            // make sure that the correct wallet was removed

            expect(allWallets?.[0].address).toBe(wallet.address);
            expect(allWallets?.[1].address).toBe(userWallet3.address);
            expect(allWallets).toHaveLength(2);

            // assert
            expect(result.includes('removed')).toBeTruthy();
        });
        it('should not remove the wallet because the user is not found', async () => {
            try {
                await userRepo.removeWalletFromUser('12345', '11111');
            } catch (error) {
                expect(error).toHaveProperty(
                    'message',
                    `AlgoWallet not found ({ address: '11111' })`
                );
            }
        });
        it('should not remove the wallet if the user has unclaimed tokens', async () => {
            const randomASA = await createRandomASA(database);
            const algoStdTokenRepo = database.getRepository(AlgoStdToken);
            const getTokenFromAlgoNetwork = jest.spyOn(algoStdTokenRepo, 'getTokenFromAlgoNetwork');
            getTokenFromAlgoNetwork.mockResolvedValueOnce({ optedIn: true, tokens: 1000 });

            await algoStdTokenRepo.addAlgoStdToken(wallet, randomASA);
            await algoStdTokenRepo.addUnclaimedTokens(wallet, randomASA.id, 1000);
            const removed = await userRepo.removeWalletFromUser(user.id, wallet.address);
            expect(removed).toBe(
                'You have unclaimed tokens. Please check your wallet before removing it.'
            );
        });
    });
});