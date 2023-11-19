import { setupMongo, tearDownMongo } from '../../../tests/setup/mongodb.setup.js';
import { DiscordId } from '../../types/core.js';

import { rewardsModel } from './rewards.js';
import { RewardsRepository } from './rewards.repo.js';

describe('RewardsRepository', () => {
  let rewardsRepository: RewardsRepository;
  const discordUserId = 'testDiscordId' as DiscordId;
  const walletAddress = 'testWalletAddress';
  const asaId = 1;
  beforeAll(async () => {
    await setupMongo();
    rewardsRepository = new RewardsRepository();
  });
  afterEach(async () => {
    await rewardsModel.deleteMany({});
  });
  afterAll(async () => {
    await tearDownMongo(rewardsModel);
  });
  describe('Update Temporary Tokens', () => {
    it('should update temporary tokens', async () => {
      const amount = 1;
      const reward = await rewardsRepository.updateTemporaryTokens(
        discordUserId,
        walletAddress,
        asaId,
        amount,
      );
      expect(reward).toBe(1);
    });
    it('should update temporary tokens when a document exists', async () => {
      const amount = 1;
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount);
      const reward = await rewardsRepository.updateTemporaryTokens(
        discordUserId,
        walletAddress,
        asaId,
        amount,
      );
      expect(reward).toBe(2);
    });
    it('should update it to negative', async () => {
      const amount = -1;
      const reward = await rewardsRepository.updateTemporaryTokens(
        discordUserId,
        walletAddress,
        asaId,
        amount,
      );
      expect(reward).toBe(-1);
    });
    it('should attempt create a duplicate reward document and fail', async () => {
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, 1);
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, 0);
      const allTokens = await rewardsRepository.getAllRewardTokensByWallet(walletAddress);
      expect(allTokens).toHaveLength(1);
    });
    it('should remove 5 tokens', async () => {
      const amount = -5;
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, 10);
      const reward = await rewardsRepository.updateTemporaryTokens(
        discordUserId,
        walletAddress,
        asaId,
        amount,
      );
      expect(reward).toBe(5);
      const allTokens = await rewardsRepository.getAllRewardTokensByWallet(walletAddress);
      expect(allTokens).toHaveLength(1);
    });
  });
  describe('Find Rewards Functions', () => {
    it('should return all reward tokens for a wallet', async () => {
      const amount = 1;
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount);
      const allTokens = await rewardsRepository.getAllRewardTokensByWallet(walletAddress);
      expect(allTokens).toHaveLength(1);
    });
    it('should return all reward tokens for a user and asset', async () => {
      const amount = 1;
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount);
      const allTokens = await rewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId);
      expect(allTokens).toHaveLength(1);
    });
    it('should return all wallets with temporary tokens above threshold', async () => {
      const amount = 1;
      await rewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount);
      const allTokens = await rewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
        asaId,
        undefined,
        discordUserId,
      );
      expect(allTokens).toHaveLength(1);
    });
  });
});
