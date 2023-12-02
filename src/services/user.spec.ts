import { mongo } from 'mongoose';
import { instance, mock, spy, verify, when } from 'ts-mockito';

import { mockedFakeUser } from '../../tests/mocks/mock-functions.js';
import { UserRepository } from '../database/user/user.repo.js';
import { DatabaseUser } from '../database/user/user.schema.js';
import { GlobalEmitter } from '../emitters/global-emitter.js';
import { NFDomainsManager } from '../manager/nf-domains.js';
import { DiscordId, WalletAddress } from '../types/core.js';

import { userWalletActionsTemplate, userWalletOwnedTemplate } from './user.formatter.js';
import { UserService } from './user.js';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: UserRepository;
  let mockNFDomainsMgr: NFDomainsManager;
  let mockGlobalEmitter: GlobalEmitter;
  const discordUserId = 'testDiscordUserId' as DiscordId;
  const walletAddress = 'testWallet1' as WalletAddress;
  const walletAddress2 = 'testWallet2' as WalletAddress;
  const fakeUser = mockedFakeUser(discordUserId);
  beforeEach(() => {
    // Create mocks
    mockUserRepo = mock(UserRepository);
    mockNFDomainsMgr = mock(NFDomainsManager);
    mockGlobalEmitter = mock(GlobalEmitter);

    // Create UserService instance with mocked dependencies
    userService = new UserService(
      instance(mockUserRepo),
      instance(mockNFDomainsMgr),
      instance(mockGlobalEmitter),
    );
  });
  describe('getUserWallets', () => {
    it('should return an empty array if the user is invalid', async () => {
      // Mock the getUserByID method to return null
      when(mockUserRepo.getUserByID(discordUserId)).thenResolve(null);

      const wallets = await userService.getUserWallets(discordUserId);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByID(discordUserId)).once();

      expect(wallets).toEqual([]);
    });
    it('should return an empty array if user has no wallets', async () => {
      // Mock the getUserByID method to return a user with no wallets
      when(mockUserRepo.getUserByID(discordUserId)).thenResolve({} as DatabaseUser);

      const wallets = await userService.getUserWallets(discordUserId);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByID(discordUserId)).once();

      expect(wallets).toEqual([]);
    });
    it('should return user wallets', async () => {
      const expectedWallets = [walletAddress, walletAddress2];

      // Mock the getUserByID method to return a user with wallets
      when(mockUserRepo.getUserByID(discordUserId)).thenResolve({
        algoWallets: expectedWallets.map((address) => ({ address })),
      } as DatabaseUser);

      const wallets = await userService.getUserWallets(discordUserId);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByID(discordUserId)).once();

      expect(wallets).toEqual(expectedWallets);
    });
  });

  describe('addWalletToUser', () => {
    it('should add wallet to user', async () => {
      // Mock the walletOwnedByAnotherUser method to resolve without error
      const userServiceSpy = spy(userService);
      when(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).thenResolve();
      // Mock the upsertWalletToUser method to resolve without error
      when(mockUserRepo.upsertWalletToUser(walletAddress, discordUserId)).thenResolve();

      const result = await userService.addWalletToUser(walletAddress, discordUserId);

      // Verify the methods were called with the correct arguments
      verify(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).once();
      verify(mockUserRepo.upsertWalletToUser(walletAddress, discordUserId)).once();
      verify(mockGlobalEmitter.emitLoadTemporaryTokens(walletAddress, discordUserId)).once();

      expect(result).toBe(userWalletActionsTemplate.WalletAdded({ walletAddress, discordUserId }));
    });
    it('should return the error thrown by walletOwnedByAnotherUser', async () => {
      // Mock the walletOwnedByAnotherUser method to reject with an error
      const userServiceSpy = spy(userService);
      when(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).thenReject(
        new Error('test error'),
      );

      const result = await userService.addWalletToUser(walletAddress, discordUserId);

      // Verify the method was called with the correct argument
      verify(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).once();

      expect(result).toBe('test error');
    });
    it('should throw an error because its not an instance of Error', async () => {
      // Mock the walletOwnedByAnotherUser method to reject with an error
      const userServiceSpy = spy(userService);
      when(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).thenReject(
        'test error' as unknown as Error,
      );

      await expect(userService.addWalletToUser(walletAddress, discordUserId)).rejects.toBe(
        'test error',
      );

      // Verify the method was called with the correct argument
      verify(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).once();
    });
    it('should return wallet already exists message', async () => {
      // Mock the walletOwnedByAnotherUser method to resolve without error
      const userServiceSpy = spy(userService);
      when(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).thenResolve();
      // Mock the upsertWalletToUser method to reject with an E11000 error
      when(mockUserRepo.upsertWalletToUser(walletAddress, discordUserId)).thenReject(
        new mongo.MongoServerError({ message: 'test error', code: 11_000 }),
      );

      const result = await userService.addWalletToUser(walletAddress, discordUserId);

      // Verify the methods were called with the correct arguments
      verify(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).once();
      verify(mockUserRepo.upsertWalletToUser(walletAddress, discordUserId)).once();

      expect(result).toBe(
        userWalletActionsTemplate.WalletAlreadyExists({ walletAddress, discordUserId }),
      );
    });
    it('should return wallet error message', async () => {
      // Mock the walletOwnedByAnotherUser method to resolve without error
      const userServiceSpy = spy(userService);
      when(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).thenResolve();
      // Mock the upsertWalletToUser method to reject with an error
      when(mockUserRepo.upsertWalletToUser(walletAddress, discordUserId)).thenReject(
        new Error('test error'),
      );

      const result = await userService.addWalletToUser(walletAddress, discordUserId);

      // Verify the methods were called with the correct arguments
      verify(userServiceSpy.walletOwnedByAnotherUser(discordUserId, walletAddress)).once();
      verify(mockUserRepo.upsertWalletToUser(walletAddress, discordUserId)).once();

      expect(result).toBe(
        userWalletActionsTemplate.ErrorAddingWallet({ walletAddress, discordUserId }),
      );
    });
    describe('addUser', () => {
      it('should add user', async () => {
        // Mock the addUser method to resolve without error
        when(mockUserRepo.addUser(discordUserId)).thenResolve();

        await userService.addUser(discordUserId);

        // Verify the method was called with the correct argument
        verify(mockUserRepo.addUser(discordUserId)).once();
      });
    });
    describe('getUserByID', () => {
      it('should return user', async () => {
        // Mock the getUserByID method to resolve with a user
        when(mockUserRepo.getUserByID(discordUserId)).thenResolve({} as DatabaseUser);

        const user = await userService.getUserByID(discordUserId);

        // Verify the method was called with the correct argument
        verify(mockUserRepo.getUserByID(discordUserId)).once();

        expect(user).toEqual({});
      });
      it('should add user and return user', async () => {
        // Mock the getUserByID method to resolve with null
        when(mockUserRepo.getUserByID(discordUserId)).thenResolve(null).thenResolve(fakeUser);
        // Mock the addUser method to resolve without error
        when(mockUserRepo.addUser(discordUserId)).thenResolve();

        const user = await userService.getUserByID(discordUserId);

        // Verify the methods were called with the correct arguments
        verify(mockUserRepo.getUserByID(discordUserId)).twice();
        verify(mockUserRepo.addUser(discordUserId)).once();

        expect(user).toEqual(fakeUser);
      });
      it('should throw an error because user is null', async () => {
        // Mock the getUserByID method to resolve with null
        when(mockUserRepo.getUserByID(discordUserId)).thenResolve(null).thenResolve(null);

        await expect(userService.getUserByID(discordUserId)).rejects.toThrow(
          new Error(`User not found: ${discordUserId}`),
        );

        // Verify the method was called with the correct argument
        verify(mockUserRepo.getUserByID(discordUserId)).twice();
      });
    });
  });
  describe('getUserByWallet', () => {
    it('should return user', async () => {
      // Mock the getUserByWallet method to resolve with a user
      when(mockUserRepo.getUserByWallet(walletAddress)).thenResolve({} as DatabaseUser);

      const user = await userService.getUserByWallet(walletAddress);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByWallet(walletAddress)).once();

      expect(user).toEqual({});
    });
    it('should throw an error because user is null', async () => {
      // Mock the getUserByWallet method to resolve with null
      when(mockUserRepo.getUserByWallet(walletAddress)).thenResolve(null);

      await expect(userService.getUserByWallet(walletAddress)).rejects.toThrow(
        new Error(`Wallet not found: ${walletAddress}`),
      );

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByWallet(walletAddress)).once();
    });
  });
  describe('getAllUsers', () => {
    it('should return users', async () => {
      const expectedUsers = [fakeUser];

      // Mock the getAllUsers method to resolve with users
      when(mockUserRepo.getAllUsers()).thenResolve(expectedUsers);

      const users = await userService.getAllUsers();

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getAllUsers()).once();

      expect(users).toEqual(expectedUsers);
    });
  });
  describe('removeWalletFromUser', () => {
    it('should remove wallet from user', async () => {
      // Mock the removeWalletFromUser method to resolve without error
      when(mockUserRepo.removeWalletFromUser(walletAddress, discordUserId)).thenResolve();

      await userService.removeWalletFromUser(walletAddress, discordUserId);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.removeWalletFromUser(walletAddress, discordUserId)).once();
    });
  });
  describe('isWalletOwnedByOtherDiscordID', () => {
    it('should return true', async () => {
      // Mock the isWalletOwnedByOtherDiscordID method to resolve with true
      when(
        mockNFDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress),
      ).thenResolve(true);

      const result = await userService.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress);

      // Verify the method was called with the correct argument
      verify(mockNFDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress)).once();

      expect(result).toBe(true);
    });
    it('should return false', async () => {
      // Mock the isWalletOwnedByOtherDiscordID method to resolve with false
      when(
        mockNFDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress),
      ).thenResolve(false);

      const result = await userService.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress);

      // Verify the method was called with the correct argument
      verify(mockNFDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress)).once();

      expect(result).toBe(false);
    });
  });
  describe('updateUserArtifacts', () => {
    it('should update user artifacts', async () => {
      // Mock the updateUserArtifacts method to resolve with a user
      when(mockUserRepo.updateUserArtifacts(discordUserId, 1)).thenResolve(fakeUser);

      const result = await userService.updateUserArtifacts(discordUserId, 1);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.updateUserArtifacts(discordUserId, 1)).once();

      expect(result).toBe(fakeUser.artifactToken.toLocaleString());
    });
    it('should throw an error because user is null', async () => {
      // Mock the updateUserArtifacts method to resolve with null
      when(mockUserRepo.updateUserArtifacts(discordUserId, 1)).thenResolve(null);

      await expect(userService.updateUserArtifacts(discordUserId, 1)).rejects.toThrow(
        new Error(`Not enough artifacts to update user: ${discordUserId} with quantity: 1`),
      );

      // Verify the method was called with the correct argument
      verify(mockUserRepo.updateUserArtifacts(discordUserId, 1)).once();
    });
  });
  describe('walletOwnedByAnotherUser', () => {
    it('should resolve without error', async () => {
      // Mock the getUserByWallet method to resolve with a user
      when(mockUserRepo.getUserByWallet(walletAddress)).thenResolve(fakeUser);

      await userService.walletOwnedByAnotherUser(discordUserId, walletAddress);

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByWallet(walletAddress)).once();
    });
    it('shoudl reject because wallet found on nf domains', async () => {
      // Mock the getUserByWallet method to resolve with a user
      when(mockUserRepo.getUserByWallet(walletAddress)).thenResolve(fakeUser);
      // Mock the isWalletOwnedByOtherDiscordID method to resolve with true
      when(
        mockNFDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress),
      ).thenResolve(true);

      await expect(
        userService.walletOwnedByAnotherUser(discordUserId, walletAddress),
      ).rejects.toThrow(
        new Error(userWalletOwnedTemplate.WalletFoundOnNFDomains({ walletAddress, discordUserId })),
      );

      // Verify the method was called with the correct argument
      verify(mockNFDomainsMgr.isWalletOwnedByOtherDiscordID(discordUserId, walletAddress)).once();
    });
    it('should reject with an error because user is not the same', async () => {
      // Mock the getUserByWallet method to resolve with a different user
      when(mockUserRepo.getUserByWallet(walletAddress)).thenResolve({
        _id: 'testDiscordUserId2',
      } as DatabaseUser);

      await expect(
        userService.walletOwnedByAnotherUser(discordUserId, walletAddress),
      ).rejects.toThrow(
        new Error(
          userWalletOwnedTemplate.WalletOwnedByAnotherUser({ walletAddress, discordUserId }),
        ),
      );

      // Verify the method was called with the correct argument
      verify(mockUserRepo.getUserByWallet(walletAddress)).once();
    });
  });
});
