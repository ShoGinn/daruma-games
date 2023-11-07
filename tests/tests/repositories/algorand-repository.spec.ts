// Import other necessary dependencies and test utilities
import { UnclaimedAsset } from '../../../src/model/types/algorand.js';
import { AlgorandRepository } from '../../../src/repositories/algorand-repository.js';

describe('AlgorandRepository', () => {
  let repository: AlgorandRepository;
  let ormMock;
  let unclaimedAsset: UnclaimedAsset;
  // Create a setup function to initialize the repository before each test
  beforeEach(() => {
    // Initialize the mock ORM
    ormMock = {
      em: {
        fork: jest.fn().mockReturnThis(),
        getRepository: jest.fn().mockReturnThis(),
        removeAndFlush: jest.fn().mockReturnThis(),
        // Mock other necessary methods and properties
      },
    };
    // Mock the findOneOrFail method in getRepository('AlgoStdToken')
    ormMock.em.getRepository.mockReturnValue({
      findOneOrFail: jest.fn().mockResolvedValue({}),
      removeUnclaimedTokens: jest.fn().mockResolvedValue({}),
      syncUserWallets: jest.fn().mockResolvedValue({}),
      userAssetSync: jest.fn().mockResolvedValue({}),
      getAllUsers: jest.fn().mockResolvedValue([]),
      allWalletsOptedIn: jest.fn().mockResolvedValue([]),
      getWalletWithUnclaimedTokens: jest.fn().mockResolvedValue({}),
    });
    // Initialize the repository with the mock ORM
    repository = new AlgorandRepository(ormMock);
    unclaimedAsset = {
      id: 123,
      name: 'assetName',
      unitName: 'unitName',
    };
  });
  describe('removeUnclaimedTokensFromMultipleWallets', () => {
    test('should remove unclaimed tokens from multiple wallets', async () => {
      // Mock the chunk of wallets
      const chunk = [
        {
          walletAddress: 'walletAddress1',
          unclaimedTokens: 1,
          userId: 'userId1',
        },
        {
          walletAddress: 'walletAddress2',
          unclaimedTokens: 2,
          userId: 'userId2',
        },
      ];

      // Call the method under test
      await repository.removeUnclaimedTokensFromMultipleWallets(chunk, unclaimedAsset);

      // Assert that the method under test called the expected methods
      expect(ormMock.em.fork).toHaveBeenCalledTimes(1);
      expect(ormMock.em.getRepository).toHaveBeenCalledTimes(3);
    });
  });
  describe('fetchWalletsWithUnclaimedAssets', () => {
    test('should fetch empty wallets because none of the wallets have unclaimed tokens', async () => {
      // Call the method under test
      const result = await repository.fetchWalletsWithUnclaimedAssets(1, unclaimedAsset);

      // Assert that the method under test called the expected methods
      expect(result).toEqual([]);
      expect(ormMock.em.fork).toHaveBeenCalledTimes(1);
      expect(ormMock.em.getRepository).toHaveBeenCalledTimes(3);
      expect(ormMock.em.getRepository('AlgoWallet').allWalletsOptedIn).toHaveBeenCalledTimes(0);
      expect(
        ormMock.em.getRepository('AlgoStdToken').getWalletWithUnclaimedTokens,
      ).toHaveBeenCalledTimes(0);
    });
    test('should fetch a wallet that isnt optedIn', async () => {
      // Mock the allWalletsOptedIn method
      ormMock.em.getRepository.mockReturnValue({
        userAssetSync: jest.fn().mockResolvedValue({}),
        getAllUsers: jest.fn().mockResolvedValue([{ id: 'userId' }]),

        allWalletsOptedIn: jest.fn().mockReturnValueOnce({ optedInWallets: [] }),
        getWalletWithUnclaimedTokens: jest.fn().mockReturnValueOnce({
          unclaimedTokens: 200,
        }),
      });

      // Call the method under test
      const result = await repository.fetchWalletsWithUnclaimedAssets(1, unclaimedAsset);

      // Assert that the method under test called the expected methods
      expect(result).toEqual([]);
      expect(ormMock.em.fork).toHaveBeenCalledTimes(1);
      expect(ormMock.em.getRepository).toHaveBeenCalledTimes(3);
      expect(ormMock.em.getRepository('AlgoWallet').allWalletsOptedIn).toHaveBeenCalledTimes(1);
      expect(
        ormMock.em.getRepository('AlgoStdToken').getWalletWithUnclaimedTokens,
      ).toHaveBeenCalledTimes(0);
    });

    test('should fetch a wallet with unclaimed tokens', async () => {
      // Mock the allWalletsOptedIn method
      ormMock.em.getRepository.mockReturnValue({
        userAssetSync: jest.fn().mockResolvedValue({}),
        getAllUsers: jest.fn().mockResolvedValue([{ id: 'userId' }]),

        allWalletsOptedIn: jest.fn().mockReturnValueOnce({
          optedInWallets: [
            {
              address: 'walletAddress',
            },
          ],
        }),
        getWalletWithUnclaimedTokens: jest.fn().mockReturnValueOnce({
          unclaimedTokens: 200,
        }),
      });

      // Call the method under test
      const result = await repository.fetchWalletsWithUnclaimedAssets(1, unclaimedAsset);

      // Assert that the method under test called the expected methods
      expect(result).toEqual([
        {
          walletAddress: 'walletAddress',
          unclaimedTokens: 200,
          userId: 'userId',
        },
      ]);
      expect(ormMock.em.fork).toHaveBeenCalledTimes(1);
      expect(ormMock.em.getRepository).toHaveBeenCalledTimes(3);
      expect(ormMock.em.getRepository('AlgoWallet').allWalletsOptedIn).toHaveBeenCalledTimes(1);
      expect(
        ormMock.em.getRepository('AlgoStdToken').getWalletWithUnclaimedTokens,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
