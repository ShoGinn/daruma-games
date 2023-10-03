import { EntityManager, MikroORM } from '@mikro-orm/core';
import mockAxios from 'axios';
import { inlineCode } from 'discord.js';

import { AlgoWallet } from '../../../../src/entities/algo-wallet.entity.js';
import { User, UserRepository } from '../../../../src/entities/user.entity.js';
import {
	createNFDWalletRecords,
	mockNoNFDWalletData,
} from '../../../mocks/mock-nfd-data.js';
import { initORM } from '../../../utils/bootstrap.js';
import {
	createRandomUser,
	createRandomWallet,
	generateDiscordId,
} from '../../../utils/test-funcs.js';
jest.mock('axios');

describe('User tests that require db', () => {
	let orm: MikroORM;
	let database: EntityManager;
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
		database = orm.em.fork();
		userRepo = database.getRepository(User);
		mockRequest = jest.fn();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(mockAxios as any).get = mockRequest;
		user = await createRandomUser(database);
		wallet = await createRandomWallet(database, user);
	});
	describe('sync user wallets', () => {
		beforeEach(async () => {
			await createRandomWallet(database, user);
			await createRandomWallet(database, user);
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
			const user3 = await createRandomUser(database);
			const result = await userRepo.syncUserWallets(user3.id);
			// assert
			expect(result).toBe('No wallets found');
		});
		it('should sync the wallets', async () => {
			const addWalletAndSyncAssetsMock = jest.spyOn(
				userRepo,
				'addWalletAndSyncAssets',
			);
			addWalletAndSyncAssetsMock.mockResolvedValue('wallet synced');
			const result = await userRepo.syncUserWallets(user.id);
			// assert
			expect(result).toBe('wallet synced\nwallet synced\nwallet synced');
		});
		it('should run the auto sync for wallets', async () => {
			const addWalletAndSyncAssetsMock = jest.spyOn(
				userRepo,
				'addWalletAndSyncAssets',
			);
			addWalletAndSyncAssetsMock.mockResolvedValue('wallet synced');
			const result = await userRepo.userAssetSync();
			// assert
			expect(result).toBe('User Asset Sync Complete -- 1 users');
		});
	});
	describe('addWalletAndSyncAssets', () => {
		beforeEach(() => {
			mockRequest.mockResolvedValue(mockNoNFDWalletData);
		});

		it('should refresh the wallet with the appropriate response', async () => {
			const response = {
				assetsUpdated: {
					assetsAdded: 10,
					assetsRemoved: 0,
					walletAssets: 10,
				},
				asaAssetsString: 'test',
			};
			const addAllAssetsToWalletMock = jest.spyOn(
				userRepo,
				'addAllAssetsToWallet',
			);
			addAllAssetsToWalletMock.mockResolvedValue(response);

			let result = await userRepo.addWalletAndSyncAssets(user, wallet.address);
			expect(result).toContain(inlineCode(wallet.address));
			expect(result).toContain('10');
			expect(result).toContain('test');
			expect(result).toContain('Added');
			result = await userRepo.addWalletAndSyncAssets(user.id, wallet.address);
			expect(result).toContain(inlineCode(wallet.address));
			expect(result).toContain('10');
			expect(result).toContain('test');
			expect(result).toContain('Added');
		});
		it('should return invalid because the NFDomain', async () => {
			const response = {
				assetsUpdated: {
					assetsAdded: 10,
					assetsRemoved: 0,
					walletAssets: 10,
				},
				asaAssetsString: 'test',
			};
			const expectedData = createNFDWalletRecords(
				wallet.address,
				undefined,
				generateDiscordId(),
			);
			mockRequest.mockResolvedValueOnce({ data: expectedData });

			const addAllAssetsToWalletMock = jest.spyOn(
				userRepo,
				'addAllAssetsToWallet',
			);
			addAllAssetsToWalletMock.mockResolvedValue(response);
			const result = await userRepo.addWalletAndSyncAssets(
				user,
				wallet.address,
			);
			expect(result).toContain(inlineCode(wallet.address));
			expect(result).toContain('NFT Domain');
		});
	});
});
