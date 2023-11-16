import mockAxios from 'axios';

import { mockNoNFDWalletData } from '../../../mocks/mock-nfd-data.js';
import { generateAlgoWalletAddress, generateDiscordId } from '../../../utils/test-funcs.js';

jest.mock('axios');

describe('User tests that require db', () => {
  let mockRequest: jest.Mock;
  let isWalletInvalid: boolean;

  beforeAll(async () => {
    isWalletInvalid = false;
    mockRequest = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAxios as any).get = mockRequest;

    mockRequest.mockResolvedValue(mockNoNFDWalletData);
  });
  afterAll(async () => {
    jest.restoreAllMocks();
  });
  describe('addWalletToUser', () => {
    describe('Wallet listed on the NFDomain and owned by the discord user or not owned at all (valid wallet)', () => {
      test('should add the wallet', async () => {
        // act
        const result = await userRepo.addNewWalletToUser(user.id, generateAlgoWalletAddress());

        // assert

        expect(result.walletOwnerMessage?.includes('Added.')).toBeTruthy();

        expect(result.isWalletInvalid).toBe(isWalletInvalid);
        expect(result.walletOwner).toBeNull();
      });
      test('adding multiple wallets should work as expected', async () => {
        // act
        await expect(algoWalletRepo.findAll()).resolves.toHaveLength(2);
        const result = await userRepo.addNewWalletToUser(user.id, wallet.address);
        const result2 = await userRepo.addNewWalletToUser(user.id, generateAlgoWalletAddress());
        const result3 = await userRepo.addNewWalletToUser(user.id, generateAlgoWalletAddress());

        // assert
        expect(result.walletOwnerMessage?.includes('refreshed.')).toBeTruthy();
        expect(result2.walletOwnerMessage?.includes('Added.')).toBeTruthy();
        expect(result3.walletOwnerMessage?.includes('Added.')).toBeTruthy();

        expect(result2.isWalletInvalid).toBe(isWalletInvalid);
        expect(result3.isWalletInvalid).toBe(isWalletInvalid);

        expect(result2.walletOwner).toBeNull();
        expect(result3.walletOwner).toBeNull();
        await expect(algoWalletRepo.findAll()).resolves.toHaveLength(4);
      });
      test('should not add the wallet', async () => {
        // act
        const result = await userRepo.addNewWalletToUser(user.id, wallet.address);

        // assert

        expect(result.walletOwnerMessage?.includes('has been refreshed.')).toBeTruthy();

        expect(result.isWalletInvalid).toBe(isWalletInvalid);
        expect(result.walletOwner).toBe(user);
      });
      test('should not add the wallet because the user is not found', async () => {
        // act
        expect.assertions(1);
        await expect(
          userRepo.addNewWalletToUser(generateDiscordId(), generateAlgoWalletAddress()),
        ).rejects.toThrow('User not found.');
      });

      test('should not add the wallet because its owned by another user', async () => {
        // act
        await userRepo.addNewWalletToUser(user.id, wallet.address);

        const newUser = await createRandomUser(database);
        const result = await userRepo.addNewWalletToUser(newUser.id, wallet.address);

        // assert

        expect(result.walletOwnerMessage?.includes('already owned by another')).toBeTruthy();

        expect(result.isWalletInvalid).not.toBe(isWalletInvalid);
        expect(result.walletOwner).toBe(user);
      });
    });
  });
});
