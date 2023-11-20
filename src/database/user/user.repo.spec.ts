import { faker } from '@faker-js/faker';

import { mongoFixture } from '../../../tests/setup/mongodb.setup.js';
import { DiscordId, WalletAddress } from '../../types/core.js';

import { userModel } from './user.js';
import { UserRepository } from './user.repo.js';
import { IUser } from './user.schema.js';

describe('UserRepository', () => {
  mongoFixture(userModel);
  let userRepository: UserRepository;
  const mockUser: IUser = {
    _id: faker.string.numeric(9) as DiscordId,
    algoWallets: [],
    artifactToken: 0,
  };
  const mockWalletAddress = faker.lorem.word() as WalletAddress;
  beforeAll(() => {
    userRepository = new UserRepository();
  });
  describe('add user', () => {
    it('should add a user', async () => {
      await userRepository.addUser(mockUser._id);
      const user = await userRepository.getUserByID(mockUser._id);
      expect(user).toMatchObject(mockUser);
    });
  });
  describe('get user functions', () => {
    it('should not find a user that does not exist', async () => {
      const user = await userRepository.getUserByID(mockUser._id);
      expect(user).toBeNull();
    });
    it('should get all users', async () => {
      await userModel.create(mockUser);
      const users = await userRepository.getAllUsers();
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject(mockUser);
    });
  });
  describe('wallet functions', () => {
    it('should add a wallet to an existing user', async () => {
      await userModel.create(mockUser);
      const user = await userRepository.upsertWalletToUser(mockWalletAddress, mockUser._id);
      const allUsers = await userRepository.getAllUsers();
      expect(allUsers).toHaveLength(1);
      expect(user?.algoWallets).toHaveLength(1);
    });
    it('should add a user if they do not exist and add a wallet', async () => {
      const user = await userRepository.upsertWalletToUser(mockWalletAddress, mockUser._id);
      const expectedUser = {
        ...mockUser,
        algoWallets: [{ address: mockWalletAddress }],
      };
      expect(user).toMatchObject(expectedUser);
    });
    it('should throw an error if the wallet already exists', async () => {
      await userModel.create(mockUser);
      await userRepository.upsertWalletToUser(mockWalletAddress, mockUser._id);
      await expect(
        userRepository.upsertWalletToUser(mockWalletAddress, mockUser._id),
      ).rejects.toThrow();
    });
    it('should remove a wallet from a user', async () => {
      const expectedDeletedCount = 1;
      const expectedResult = {
        modifiedCount: expectedDeletedCount,
        acknowledged: true,
        matchedCount: expectedDeletedCount,
        upsertedCount: 0,
        upsertedId: null,
      };

      await userRepository.upsertWalletToUser(mockWalletAddress, mockUser._id);
      const user = await userRepository.removeWalletFromUser(mockWalletAddress, mockUser._id);
      const allUsers = await userRepository.getAllUsers();
      expect(user).toMatchObject(expectedResult);
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0]!.algoWallets).toHaveLength(0);
    });
    it('should not remove a wallet from a user that does not exist', async () => {
      const expectedDeletedCount = 0;
      const expectedResult = {
        modifiedCount: expectedDeletedCount,
        acknowledged: true,
        matchedCount: expectedDeletedCount,
        upsertedCount: 0,
        upsertedId: null,
      };

      const user = await userRepository.removeWalletFromUser(mockWalletAddress, mockUser._id);
      const allUsers = await userRepository.getAllUsers();
      expect(allUsers).toHaveLength(0);
      expect(user).toMatchObject(expectedResult);
    });
    it('should not remove a wallet from a user that does not have that wallet', async () => {
      const expectedDeletedCount = 0;
      const expectedResult = {
        modifiedCount: expectedDeletedCount,
        acknowledged: true,
        matchedCount: 1,
        upsertedCount: 0,
        upsertedId: null,
      };

      await userModel.create(mockUser);
      const user = await userRepository.removeWalletFromUser(mockWalletAddress, mockUser._id);
      const allUsers = await userRepository.getAllUsers();
      expect(allUsers).toHaveLength(1);
      expect(user).toMatchObject(expectedResult);
    });
    it('should get a user by the wallet address', async () => {
      await userRepository.upsertWalletToUser(mockWalletAddress, mockUser._id);
      const user = await userRepository.getUserByWallet(mockWalletAddress);
      const expectedUser = {
        ...mockUser,
        algoWallets: [{ address: mockWalletAddress }],
      };
      expect(user).toMatchObject(expectedUser);
    });
    it('should not get a user by the wallet address if they do not exist', async () => {
      const user = await userRepository.getUserByWallet(mockWalletAddress);
      expect(user).toBeNull();
    });
  });
  describe('artifact manipulation', () => {
    it('should add 1 to user artifacts', async () => {
      await userModel.create(mockUser);
      await userRepository.updateUserArtifacts(mockUser._id, 1);
      const user = await userRepository.getUserByID(mockUser._id);
      expect(user?.artifactToken).toBe(mockUser.artifactToken + 1);
    });
    it('should add 5 and remove 3 from user artifacts', async () => {
      await userModel.create(mockUser);
      await userRepository.updateUserArtifacts(mockUser._id, 5);
      await userRepository.updateUserArtifacts(mockUser._id, -3);
      const user = await userRepository.getUserByID(mockUser._id);
      expect(user?.artifactToken).toBe(mockUser.artifactToken + 2);
    });
    it('should not update user artifacts if user does not exist', async () => {
      await userRepository.updateUserArtifacts(mockUser._id, 1);
      const user = await userRepository.getUserByID(mockUser._id);
      expect(user).toBeNull();
    });
    it('should not update user artifacts if quantity is negative', async () => {
      const thisUser = { ...mockUser, artifactToken: 10 };
      await userModel.create(thisUser);
      await userRepository.updateUserArtifacts(mockUser._id, -20);
      const user = await userRepository.getUserByID(mockUser._id);
      expect(user?.artifactToken).toBe(10);
    });
  });
});
