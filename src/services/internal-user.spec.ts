import { mongo } from 'mongoose';
import { anyOfClass, anything, deepEqual, instance, mock, spy, verify, when } from 'ts-mockito';

import { AlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { AppStateRepository } from '../database/app-state/app-state.repo.js';
import { UserRepository } from '../database/user/user.repo.js';
import { DatabaseUser } from '../database/user/user.schema.js';
import { Asset } from '../types/algorand.js';
import { WalletAddress } from '../types/core.js';

import { AlgoNFTAssetService } from './algo-nft-assets.js';
import { Algorand } from './algorand.js';
import * as userMessageFormatters from './internal-user.formatter.js';
import {
  InternalUser,
  internalUserCreator,
  internalUserReserved,
  InternalUserService,
} from './internal-user.js';

describe('InternalUserService', () => {
  let internalUserService: InternalUserService;
  let mockUserRepo: UserRepository;
  let mockAlgoNFTAssetService: AlgoNFTAssetService;
  let mockAppStateRepo: AppStateRepository;
  let mockAlgorand: Algorand;
  const walletAddress = 'wallet1' as WalletAddress;
  const walletAddress2 = 'wallet2' as WalletAddress;
  const expectedDataBaseUser = {
    _id: internalUserCreator.discordId,
    algoWallets: [],
  } as unknown as DatabaseUser;
  const expectedResultOneWallet = {
    ...expectedDataBaseUser,
    algoWallets: [{ address: walletAddress }],
  } as DatabaseUser;

  beforeEach(() => {
    mockUserRepo = mock(UserRepository);
    mockAlgoNFTAssetService = mock(AlgoNFTAssetService);
    mockAlgorand = mock(Algorand);
    mockAppStateRepo = mock(AppStateRepository);

    internalUserService = new InternalUserService(
      instance(mockAppStateRepo),
      instance(mockUserRepo),
      instance(mockAlgoNFTAssetService),
      instance(mockAlgorand),
    );
  });
  describe('InternalUser Class', () => {
    it('should have the correct properties', () => {
      const internalUser = new InternalUser(1, 'username');
      expect(internalUser).toHaveProperty('discordId');
      expect(internalUser).toHaveProperty('username');
      expect(internalUser.id).toBe(1);
      expect(internalUser.discordId).toBe('1');
      expect(internalUser.username).toBe('username');
      expect(internalUser.isCreator).toBe(false);
      expect(internalUser.isReserved).toBe(false);
    });
  });
  describe('getUserWallets', () => {
    it('should return an empty array for an invalid user', async () => {
      // Mock the response from the user repository
      when(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).thenResolve(null);

      const result = await internalUserService.getUserWallets(internalUserCreator);

      expect(result).toEqual([]);
      verify(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).once();
    });
    it('should return wallets for a valid user', async () => {
      const expectedWallets: WalletAddress[] = [walletAddress, walletAddress2];

      // Mock the response from the user repository
      when(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).thenResolve({
        algoWallets: expectedWallets.map((address) => ({ address })),
      } as DatabaseUser);

      const result = await internalUserService.getUserWallets(internalUserCreator);

      expect(result).toEqual(expectedWallets);
      verify(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).once();
    });

    it('should return an empty array for a user with no wallets', async () => {
      // Mock the response from the user repository
      when(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).thenResolve({
        algoWallets: [],
      } as unknown as DatabaseUser);

      const result = await internalUserService.getUserWallets(internalUserCreator);

      expect(result).toEqual([]);
      verify(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).once();
    });
  });
  describe('addWalletToUser', () => {
    it('should add a wallet to a user', async () => {
      // Mock the response from the user repository
      when(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenResolve(expectedResultOneWallet);

      const result = await internalUserService.addWalletToUser(walletAddress, internalUserCreator);

      expect(result).toEqual(
        userMessageFormatters.internalUserWalletActionsTemplate.WalletAdded({
          walletAddress,
          internalUser: internalUserCreator,
        }),
      );
      verify(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
    });
    it('Should return wallet exists when adding an existing wallet', async () => {
      // Mock the response from the user repository
      when(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenReject(new mongo.MongoServerError({ message: 'E11000', code: 11_000 }));

      const result = await internalUserService.addWalletToUser(walletAddress, internalUserCreator);

      expect(result).toEqual(
        userMessageFormatters.internalUserWalletActionsTemplate.WalletAlreadyExists({
          walletAddress,
          internalUser: internalUserCreator,
        }),
      );
      verify(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
    });
    it('Should return error adding wallet when adding an existing wallet', async () => {
      // Mock the response from the user repository
      when(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenReject(new Error('Some other error'));

      const result = await internalUserService.addWalletToUser(walletAddress, internalUserCreator);

      expect(result).toEqual(
        userMessageFormatters.internalUserWalletActionsTemplate.ErrorAddingWallet({
          walletAddress,
          internalUser: internalUserCreator,
        }),
      );
      verify(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
    });
  });
  describe('removeWalletFromUser', () => {
    it('should remove a wallet from a user and provide the correct response', async () => {
      const expectedDeletedCount = 1;
      const expectedResult = {
        modifiedCount: expectedDeletedCount,
        acknowledged: true,
        matchedCount: expectedDeletedCount,
        upsertedCount: 0,
        upsertedId: null,
      };
      // Mock the response from the user repository
      when(
        mockUserRepo.removeWalletFromUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenResolve(expectedResult);

      const result = await internalUserService.removeWalletFromUser(
        walletAddress,
        internalUserCreator.discordId,
      );

      expect(result).toEqual(expectedResult);
      verify(
        mockUserRepo.removeWalletFromUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
    });
  });
  describe('getInternalUser', () => {
    it('should throw an error for an invalid user', async () => {
      // Mock the response from the user repository
      when(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).thenResolve(null);

      await expect(internalUserService.getInternalUser(internalUserCreator)).rejects.toThrow(
        userMessageFormatters.InternalUserNotFound({
          internalUser: internalUserCreator,
        }),
      );
      verify(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).once();
    });
    it('should return a valid user', async () => {
      // Mock the response from the user repository
      when(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).thenResolve(
        expectedDataBaseUser,
      );

      const result = await internalUserService.getInternalUser(internalUserCreator);

      expect(result).toEqual(expectedDataBaseUser);
      verify(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).once();
    });
  });
  describe('addInternalUserWallet', () => {
    it('should add a wallet to a user as creator and sync the creator assets', async () => {
      const expectedResult = {
        ...expectedDataBaseUser,
        algoWallets: [{ address: walletAddress }],
      } as DatabaseUser;
      // Mock the response from the user repository
      when(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenResolve(expectedResult);

      const result = await internalUserService.addInternalUserWallet(
        walletAddress,
        internalUserCreator,
      );

      expect(result).toEqual(
        userMessageFormatters.internalUserWalletActionsTemplate.WalletAdded({
          walletAddress,
          internalUser: internalUserCreator,
        }),
      );
      verify(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
      verify(mockAlgoNFTAssetService.updateBulkArc69()).once();
      verify(mockAlgoNFTAssetService.updateOwnerWalletsOnCreatorAssets()).once();
      verify(mockAlgorand.getCreatedAssets(walletAddress)).never();
    });
    it('should add a wallet as a reserved user and not sync the creator assets', async () => {
      const expectedResult = {
        ...expectedDataBaseUser,
        _id: internalUserReserved.discordId,
        algoWallets: [{ address: walletAddress }],
      } as DatabaseUser;
      // Mock the response from the user repository
      when(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserReserved.discordId),
        ),
      ).thenResolve(expectedResult);

      const result = await internalUserService.addInternalUserWallet(
        walletAddress,
        internalUserReserved,
      );

      expect(result).toEqual(
        userMessageFormatters.internalUserWalletActionsTemplate.WalletAdded({
          walletAddress,
          internalUser: internalUserReserved,
        }),
      );
      verify(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserReserved.discordId),
        ),
      ).once();
      verify(mockAlgoNFTAssetService.updateBulkArc69()).never();
      verify(mockAlgoNFTAssetService.updateOwnerWalletsOnCreatorAssets()).never();
      verify(mockAlgorand.getCreatedAssets(walletAddress)).never();
    });
    it('should attempt to add creator wallet that already exists and then does not sync the creator assets', async () => {
      // Mock the response from the user repository
      when(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenReject(new mongo.MongoServerError({ message: 'E11000', code: 11_000 }));

      const result = await internalUserService.addInternalUserWallet(
        walletAddress,
        internalUserCreator,
      );

      expect(result).toEqual(
        userMessageFormatters.internalUserWalletActionsTemplate.WalletAlreadyExists({
          walletAddress,
          internalUser: internalUserCreator,
        }),
      );
      verify(
        mockUserRepo.upsertWalletToUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
      verify(mockAlgoNFTAssetService.updateBulkArc69()).never();
      verify(mockAlgoNFTAssetService.updateOwnerWalletsOnCreatorAssets()).never();
      verify(mockAlgorand.getCreatedAssets(walletAddress)).never();
    });
  });
  describe('removeInternalUserWallet', () => {
    it('should remove a wallet from a user as a creator and provide the correct response', async () => {
      const messageParserSpy = spy(userMessageFormatters);

      const expectedDeletedCount = 1;
      const expectedResult = {
        modifiedCount: expectedDeletedCount,
        acknowledged: true,
        matchedCount: expectedDeletedCount,
        upsertedCount: 0,
        upsertedId: null,
      };
      // Mock the response from the user repository
      when(
        mockUserRepo.removeWalletFromUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).thenResolve(expectedResult);
      when(mockAlgoNFTAssetService.removeCreatorsAssets(deepEqual(walletAddress))).thenResolve({
        deletedCount: expectedDeletedCount,
      } as unknown as mongo.DeleteResult);
      const result = await internalUserService.removeInternalUserWallet(
        walletAddress,
        internalUserCreator,
      );

      expect(result).toBeDefined();
      verify(
        mockUserRepo.removeWalletFromUser(
          deepEqual(walletAddress),
          deepEqual(internalUserCreator.discordId),
        ),
      ).once();
      verify(mockAlgoNFTAssetService.removeCreatorsAssets(deepEqual(walletAddress))).once();
      // Verify the call to the message parser method
      verify(
        messageParserSpy.removeInternalUserWalletMessageParser(
          walletAddress,
          internalUserCreator,
          expectedDeletedCount,
          expectedDeletedCount,
          expectedDeletedCount,
        ),
      ).once();
    });
    it('should remove a wallet from a user as reserved and provide the correct response', async () => {
      const messageParserSpy = spy(userMessageFormatters);

      const expectedDeletedCount = 1;
      const expectedResult = {
        modifiedCount: expectedDeletedCount,
        acknowledged: true,
        matchedCount: expectedDeletedCount,
        upsertedCount: 0,
        upsertedId: null,
      };
      // Mock the response from the user repository
      when(
        mockUserRepo.removeWalletFromUser(
          deepEqual(walletAddress),
          deepEqual(internalUserReserved.discordId),
        ),
      ).thenResolve(expectedResult);

      const result = await internalUserService.removeInternalUserWallet(
        walletAddress,
        internalUserReserved,
      );

      expect(result).toBeDefined();
      verify(
        mockUserRepo.removeWalletFromUser(
          deepEqual(walletAddress),
          deepEqual(internalUserReserved.discordId),
        ),
      ).once();
      verify(mockAlgoNFTAssetService.removeCreatorsAssets(deepEqual(walletAddress))).never();
      // Verify the call to the message parser method
      verify(
        messageParserSpy.removeInternalUserWalletMessageParser(
          walletAddress,
          internalUserReserved,
          expectedDeletedCount,
          expectedDeletedCount,
          anything(),
        ),
      ).once();
    });
  });
  describe('creatorAssetSync', () => {
    it('should sync the creator assets', async () => {
      const addCreatorAssetsSpyon = spy(internalUserService);
      const expectedWallets = [walletAddress, walletAddress2];
      when(addCreatorAssetsSpyon.addCreatorAssets(anything(), anything())).thenResolve();
      when(mockUserRepo.getUserByID(deepEqual(internalUserCreator.discordId))).thenResolve({
        algoWallets: expectedWallets.map((address) => ({ address })),
      } as DatabaseUser);

      await internalUserService.creatorAssetSync();

      verify(addCreatorAssetsSpyon.addCreatorAssets(anything(), anything())).twice();
      verify(mockAlgorand.getCreatedAssets(walletAddress)).once();
      verify(mockAlgorand.getCreatedAssets(walletAddress2)).once();
      verify(mockAlgoNFTAssetService.updateBulkArc69()).once();
      verify(mockAlgoNFTAssetService.updateOwnerWalletsOnCreatorAssets()).once();
    });
  });
  describe('addCreatorAssets', () => {
    it('should add new assets when they do not already exist', async () => {
      const existingAssets = [] as unknown as AlgoNFTAsset[]; // Assuming no assets exist
      const newAssets = [
        { index: 1, params: { url: 'url1', name: 'name1', 'unit-name': 'unitName1' } },
        { index: 2, params: { url: 'url2', name: 'name2', 'unit-name': 'unitName2' } },
      ] as unknown as Asset[];

      when(mockAlgoNFTAssetService.getAllAssets()).thenResolve(existingAssets);

      await internalUserService.addCreatorAssets(walletAddress, newAssets);

      verify(mockAlgoNFTAssetService.addOrUpdateManyAssets(anyOfClass(Array))).once();
    });
    it('should add new assets when they do not already exist and something is wrong with the params', async () => {
      const existingAssets = [] as unknown as AlgoNFTAsset[]; // Assuming no assets exist
      const newAssets = [
        { index: 1, params: {} },
        { index: 2, params: {} },
      ] as unknown as Asset[];

      when(mockAlgoNFTAssetService.getAllAssets()).thenResolve(existingAssets);

      await internalUserService.addCreatorAssets(walletAddress, newAssets);

      verify(mockAlgoNFTAssetService.addOrUpdateManyAssets(anyOfClass(Array))).once();
    });

    it('should not add assets when they already exist', async () => {
      const existingAssets = [
        { _id: 1, creator: walletAddress, name: 'name1', unitName: 'unitName1', url: 'url1' },
      ] as unknown as AlgoNFTAsset[];
      const newAssets = [
        { index: 1, params: { url: 'url1', name: 'name1', 'unit-name': 'unitName1' } },
      ] as unknown as Asset[];

      when(mockAlgoNFTAssetService.getAllAssets()).thenResolve(existingAssets);

      await internalUserService.addCreatorAssets(walletAddress, newAssets);

      verify(mockAlgoNFTAssetService.addOrUpdateManyAssets(deepEqual([]))).once();
    });
  });
});
