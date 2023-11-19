import { setupMongo, tearDownMongo } from '../../../tests/setup/mongodb.setup.js';
import { DiscordId } from '../../types/core.js';

import { userModel } from './user.js';
import { UserRepository } from './user.repo.js';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  const userId = 'testDiscordId' as DiscordId;
  const walletAddress = 'testWalletAddress';
  beforeAll(async () => {
    await setupMongo();
    userRepository = new UserRepository();
  });
  afterAll(async () => {
    await tearDownMongo(userModel);
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
  });
  describe('add user', () => {
    it('should add a user', async () => {
      await userRepository.addUser(userId);
      const user = await userRepository.getUserByID(userId);
      expect(user).not.toBeNull();
      expect(user?.artifactToken).toBe(0);
    });
  });
  describe('get user functions', () => {
    it('should not find a user that does not exist', async () => {
      const user = await userRepository.getUserByID(userId);
      expect(user).toBeNull();
    });
    it('should get all users', async () => {
      await userRepository.addUser(userId);
      const users = await userRepository.getAllUsers();
      expect(users).toHaveLength(1);
    });
  });
  describe('wallet functions', () => {
    it('should add a wallet to an existing user', async () => {
      await userRepository.addUser(userId);
      const user = await userRepository.upsertWalletToUser(walletAddress, userId);
      const allUsers = await userRepository.getAllUsers();
      expect(allUsers).toHaveLength(1);
      expect(user?.algoWallets).toHaveLength(1);
    });
    it('should add a user if they do not exist and add a wallet', async () => {
      const user = await userRepository.upsertWalletToUser(walletAddress, userId);
      expect(user?.toJSON()).toEqual({
        __v: 0,
        _id: userId,
        artifactToken: 0,
        algoWallets: [{ address: walletAddress }],
      });
    });
    it('should throw an error if the wallet already exists', async () => {
      await userRepository.addUser(userId);
      await userRepository.upsertWalletToUser(walletAddress, userId);
      await expect(userRepository.upsertWalletToUser(walletAddress, userId)).rejects.toThrow();
    });
    it('should remove a wallet from a user', async () => {
      await userRepository.upsertWalletToUser(walletAddress, userId);
      const user = await userRepository.removeWalletFromUser(walletAddress, userId);
      const allUsers = await userRepository.getAllUsers();
      expect(user.acknowledged).toBe(true);
      expect(user.modifiedCount).toBe(1);
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0].algoWallets).toHaveLength(0);
    });
    it('should not remove a wallet from a user that does not exist', async () => {
      const user = await userRepository.removeWalletFromUser(walletAddress, userId);
      const allUsers = await userRepository.getAllUsers();
      expect(allUsers).toHaveLength(0);
      expect(user.acknowledged).toBe(true);
      expect(user.modifiedCount).toBe(0);
    });
    it('should not remove a wallet from a user that does not have that wallet', async () => {
      await userRepository.addUser(userId);
      const user = await userRepository.removeWalletFromUser(walletAddress, userId);
      const allUsers = await userRepository.getAllUsers();
      expect(allUsers).toHaveLength(1);
      expect(user.acknowledged).toBe(true);
      expect(user.modifiedCount).toBe(0);
    });
    it('should get a user by the wallet address', async () => {
      await userRepository.upsertWalletToUser(walletAddress, userId);
      const user = await userRepository.getUserByWallet(walletAddress);
      expect(user?.toJSON()).toEqual({
        __v: 0,
        _id: userId,
        artifactToken: 0,
        algoWallets: [{ address: walletAddress }],
      });
    });
    it('should not get a user by the wallet address if they do not exist', async () => {
      const user = await userRepository.getUserByWallet(walletAddress);
      expect(user).toBeNull();
    });
  });
  describe('artifact manipulation', () => {
    it('should add 1 to user artifacts', async () => {
      await userRepository.addUser(userId);
      await userRepository.updateUserArtifacts(userId, 1);
      const user = await userRepository.getUserByID(userId);
      expect(user?.artifactToken).toBe(1);
    });
    it('should add 5 and remove 3 from user artifacts', async () => {
      await userRepository.addUser(userId);
      await userRepository.updateUserArtifacts(userId, 5);
      await userRepository.updateUserArtifacts(userId, -3);
      const user = await userRepository.getUserByID(userId);
      expect(user?.artifactToken).toBe(2);
    });
    it('should not update user artifacts if user does not exist', async () => {
      await userRepository.updateUserArtifacts(userId, 1);
      const user = await userRepository.getUserByID(userId);
      expect(user).toBeNull();
    });
    it('should not update user artifacts if quantity is negative', async () => {
      await userRepository.addUser(userId);
      await userRepository.updateUserArtifacts(userId, 10);
      await userRepository.updateUserArtifacts(userId, -20);
      const user = await userRepository.getUserByID(userId);
      expect(user?.artifactToken).toBe(10);
    });
  });

  // Add more tests for other methods here...
});
