import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';

import { AlgoWallet, AlgoWalletRepository } from '../../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../../src/entities/User.entity.js';
import { initORM } from '../../../utils/bootstrap.js';
import {
    createRandomUser,
    createRandomWallet,
    generateAlgoWalletAddress,
    generateDiscordId,
} from '../../../utils/testFuncs.js';
jest.mock('axios');

describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
    let algoWalletRepo: AlgoWalletRepository;
    let user: User;
    let wallet: AlgoWallet;
    let mockRequest: jest.Mock;
    let isWalletInvalid: boolean;

    beforeAll(async () => {
        orm = await initORM();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
        algoWalletRepo = db.getRepository(AlgoWallet);
        user = await createRandomUser(db);
        wallet = await createRandomWallet(db, user);

        isWalletInvalid = false;
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;

        mockRequest.mockResolvedValue({ data: [] });
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });
    describe('addWalletToUser', () => {
        describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
            it('should add the wallet', async () => {
                // act
                const result = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert

                expect(result.walletOwnerMsg?.includes('Added.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('adding multiple wallets should work as expected', async () => {
                // act
                expect(await algoWalletRepo.findAll()).toHaveLength(2);
                const result = await userRepo.addNewWalletToUser(user.id, wallet.address);
                const result2 = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );
                const result3 = await userRepo.addNewWalletToUser(
                    user.id,
                    generateAlgoWalletAddress()
                );

                // assert
                expect(result.walletOwnerMsg?.includes('refreshed.')).toBeTruthy();
                expect(result2.walletOwnerMsg?.includes('Added.')).toBeTruthy();
                expect(result3.walletOwnerMsg?.includes('Added.')).toBeTruthy();

                expect(result2.isWalletInvalid).toBe(isWalletInvalid);
                expect(result3.isWalletInvalid).toBe(isWalletInvalid);

                expect(result2.walletOwner).toBeNull();
                expect(result3.walletOwner).toBeNull();
                expect(await algoWalletRepo.findAll()).toHaveLength(4);
            });
            it('should not add the wallet', async () => {
                // act
                const result = await userRepo.addNewWalletToUser(user.id, wallet.address);

                // assert

                expect(result.walletOwnerMsg?.includes('has been refreshed.')).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
            it('should not add the wallet because the user is not found', async () => {
                // act
                expect.assertions(1);
                try {
                    await userRepo.addNewWalletToUser(
                        generateDiscordId(),
                        generateAlgoWalletAddress()
                    );
                } catch (error) {
                    expect(error).toHaveProperty('message', 'User not found.');
                }
            });

            it('should not add the wallet because its owned by another user', async () => {
                // act
                await userRepo.addNewWalletToUser(user.id, wallet.address);

                const newUser = await createRandomUser(db);
                const result = await userRepo.addNewWalletToUser(newUser.id, wallet.address);

                // assert

                expect(result.walletOwnerMsg?.includes('already owned by another')).toBeTruthy();

                expect(result.isWalletInvalid).not.toBe(isWalletInvalid);
                expect(result.walletOwner).toBe(user);
            });
        });
    });
});
