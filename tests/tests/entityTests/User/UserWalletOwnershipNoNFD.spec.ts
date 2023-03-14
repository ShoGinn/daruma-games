import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';

import { AlgoWallet } from '../../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../../src/entities/User.entity.js';
import { createNFDWalletRecords } from '../../../mocks/mockNFDData.js';
import { initORM } from '../../../utils/bootstrap.js';
import {
    createRandomUser,
    createRandomWallet,
    generateAlgoWalletAddress,
} from '../../../utils/testFuncs.js';
jest.mock('axios');

describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
    let user: User;
    let wallet: AlgoWallet;
    let mockRequest: jest.Mock;

    beforeAll(async () => {
        orm = await initORM();
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
        user = await createRandomUser(db);
        wallet = await createRandomWallet(db, user);
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });

    describe('walletOwnedByAnotherUser', () => {
        let isWalletOwnedByOtherDiscordID: boolean;
        let isWalletInvalid: boolean;
        beforeAll(() => {
            isWalletOwnedByOtherDiscordID = false;
            isWalletInvalid = false;
        });

        describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
            it('should return null user because the wallet is not in the db', async () => {
                const newWallet = generateAlgoWalletAddress();
                const expectedData = createNFDWalletRecords(newWallet, undefined, user.id);
                mockRequest.mockResolvedValueOnce({ data: expectedData });

                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, newWallet);

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBeNull();
            });

            it('should return user because the wallet is in the db', async () => {
                const expectedData = createNFDWalletRecords(wallet.address, undefined, user.id);
                mockRequest.mockResolvedValueOnce({ data: expectedData });

                // act
                const result = await userRepo.walletOwnedByAnotherUser(user.id, wallet.address);

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).toBe(isWalletOwnedByOtherDiscordID);
                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBe(user);
            });
            it('should return other user because the wallets is in the db (also should return isWalletInvalid: true', async () => {
                const expectedData = createNFDWalletRecords(wallet.address, undefined, user.id);
                mockRequest.mockResolvedValueOnce({ data: expectedData });

                const walletOwner = await createRandomUser(db);

                // act
                const result = await userRepo.walletOwnedByAnotherUser(
                    walletOwner.id,
                    wallet.address
                );

                // assert
                expect(result.isWalletOwnedByOtherDiscordID).not.toBe(
                    isWalletOwnedByOtherDiscordID
                );

                expect(result.isWalletInvalid).not.toBe(isWalletInvalid);

                expect(result.walletOwner).not.toBe(walletOwner);
            });
        });
    });
});