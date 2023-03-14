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
    generateDiscordId,
} from '../../../utils/testFuncs.js';
jest.mock('axios');

describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
    let user: User;
    let wallet: AlgoWallet;
    let mockRequest: jest.Mock;
    let isWalletInvalid: boolean;

    beforeAll(async () => {
        orm = await initORM();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
        user = await createRandomUser(db);
        wallet = await createRandomWallet(db, user);

        isWalletInvalid = true;
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });
    describe('addWalletToUser', () => {
        describe('Wallet listed on the NFDomain and NOT owned by the discord user (invalid wallet)', () => {
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD and the user does not exist on the server', async () => {
                // act
                const newWallet = generateAlgoWalletAddress();
                const expectedData = createNFDWalletRecords(
                    newWallet,
                    undefined,
                    generateDiscordId()
                );
                mockRequest.mockResolvedValueOnce({ data: expectedData });

                const result = await userRepo.addNewWalletToUser(user.id, newWallet);

                // assert
                expect(
                    result.walletOwnerMsg?.includes('has been registered to a NFT Domain.')
                ).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);
                expect(result.walletOwner).toBeNull();
            });
            it('should not add a wallet to a user because the user does not own the wallet that is registered in the NFD', async () => {
                // act
                const expectedData = createNFDWalletRecords(
                    wallet.address,
                    undefined,
                    generateDiscordId()
                );
                mockRequest.mockResolvedValueOnce({ data: expectedData });

                const result = await userRepo.addNewWalletToUser(user.id, wallet.address);

                // assert

                expect(
                    result.walletOwnerMsg?.includes('has been registered to a NFT Domain.')
                ).toBeTruthy();

                expect(result.isWalletInvalid).toBe(isWalletInvalid);

                expect(result.walletOwner).toBe(user);
            });
        });
    });
});
