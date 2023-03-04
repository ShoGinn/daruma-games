import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';
import { inlineCode } from 'discord.js';

import { AlgoWallet } from '../../../../src/entities/AlgoWallet.entity.js';
import { User, UserRepository } from '../../../../src/entities/User.entity.js';
import { createNFDWalletRecords } from '../../../mocks/mockNFDData.js';
import { initORM } from '../../../utils/bootstrap.js';
import {
    createRandomUser,
    createRandomWallet,
    generateDiscordId,
} from '../../../utils/testFuncs.js';
jest.mock('axios');

describe('User tests that require db', () => {
    let orm: MikroORM;
    let db: EntityManager;
    let userRepo: UserRepository;
    let user: User;
    let mockRequest: jest.Mock;
    let wallet: AlgoWallet;

    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
        jest.restoreAllMocks();
    });
    beforeEach(async () => {
        await orm.schema.clearDatabase();
        db = orm.em.fork();
        userRepo = db.getRepository(User);
        mockRequest = jest.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockAxios as any).get = mockRequest;
        user = await createRandomUser(db);
        wallet = await createRandomWallet(db, user);
    });
    describe('sync user wallets', () => {
        beforeEach(async () => {
            await createRandomWallet(db, user);
            await createRandomWallet(db, user);
            mockRequest.mockResolvedValue({ data: [] });
        });
        it('should not sync the wallets because the user is not found', async () => {
            // act
            const result = await userRepo.syncUserWallets('12345');
            // assert
            expect(result).toBe('User is not registered.');
        });
        it('should not sync the wallets because the user has no wallets', async () => {
            // act
            const user3 = await createRandomUser(db);
            const result = await userRepo.syncUserWallets(user3.id);
            // assert
            expect(result).toBe('No wallets found');
        });
        it('should sync the wallets', async () => {
            const addWalletAndSyncAssetsMock = jest.spyOn(userRepo, 'addWalletAndSyncAssets');
            addWalletAndSyncAssetsMock.mockResolvedValue('wallet synced');
            const result = await userRepo.syncUserWallets(user.id);
            // assert
            expect(result).toBe('wallet synced\nwallet synced\nwallet synced');
        });
    });
    describe('addWalletAndSyncAssets', () => {
        beforeEach(() => {
            mockRequest.mockResolvedValue({ data: [] });
        });

        it('should refresh the wallet with the appropriate response', async () => {
            const response = {
                numberOfNFTAssetsAdded: 10,
                asaAssetsString: 'test',
            };
            const addAllAssetsToWalletMock = jest.spyOn(userRepo, 'addAllAssetsToWallet');
            addAllAssetsToWalletMock.mockResolvedValue(response);

            let result = await userRepo.addWalletAndSyncAssets(user, wallet.address);
            expect(result).toContain(inlineCode(wallet.address));
            expect(result).toContain('10');
            expect(result).toContain('test');
            expect(result).toContain('Synced');
            result = await userRepo.addWalletAndSyncAssets(user.id, wallet.address);
            expect(result).toContain(inlineCode(wallet.address));
            expect(result).toContain('10');
            expect(result).toContain('test');
            expect(result).toContain('Synced');
        });
        it('should return invalid because the NFDomain', async () => {
            const response = {
                numberOfNFTAssetsAdded: 10,
                asaAssetsString: 'test',
            };
            const expectedData = createNFDWalletRecords(
                wallet.address,
                undefined,
                generateDiscordId()
            );
            mockRequest.mockResolvedValueOnce({ data: expectedData });

            const addAllAssetsToWalletMock = jest.spyOn(userRepo, 'addAllAssetsToWallet');
            addAllAssetsToWalletMock.mockResolvedValue(response);
            const result = await userRepo.addWalletAndSyncAssets(user, wallet.address);
            expect(result).toContain(inlineCode(wallet.address));
            expect(result).toContain('NFT Domain');
        });
    });
});
