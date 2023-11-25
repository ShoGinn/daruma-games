import { Client } from 'discordx';

import { anyFunction, anything, instance, mock, reset, spy, verify, when } from 'ts-mockito';

import { Mock } from '../../tests/mocks/mock-discord.js';
import { mockedFakeReward, mockedFakeStdAsset } from '../../tests/mocks/mock-functions.js';
import { RewardsRepository } from '../database/rewards/rewards.repo.js';
import { Reward } from '../database/rewards/rewards.schema.js';
import { GlobalEmitter } from '../emitters/global-emitter.js';
import { GlobalEvent } from '../emitters/types.js';
import { ClaimTokenResponse, WalletWithUnclaimedAssets } from '../types/algorand.js';
import { DiscordId, RewardTokenWallet, WalletAddress } from '../types/core.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';
import { Algorand } from './algorand.js';
import { RewardsService } from './rewards.js';
import { UserService } from './user.js';

describe('RewardsService', () => {
  let service: RewardsService;
  const mockedClient = new Mock();
  let mockClient: Client;
  let mockAlgorand: Algorand;
  let mockRewardsRepository: RewardsRepository;
  let mockAlgoStdAssetsService: AlgoStdAssetsService;
  let mockUserService: UserService;
  let mockGlobalEmitter: GlobalEmitter;
  const fakeStdAsset = mockedFakeStdAsset();
  const fakeReward = mockedFakeReward(fakeStdAsset._id, 10);
  const fakeReward2 = mockedFakeReward(fakeStdAsset._id, 20);
  const discordUserId = fakeReward.discordUserId;
  const walletAddress = fakeReward.walletAddress;
  const asaId = fakeStdAsset._id;
  const amount = fakeReward.temporaryTokens;
  const expectedRewardTokenWallet = {
    convertedTokens: amount,
    discordUserId,
    walletAddress,
    asaId,
    temporaryTokens: amount,
  } as RewardTokenWallet<WalletAddress>;

  beforeEach(() => {
    mockClient = mockedClient.getClient() as Client;
    mockAlgorand = mock(Algorand);
    mockRewardsRepository = mock(RewardsRepository);
    mockAlgoStdAssetsService = mock(AlgoStdAssetsService);
    mockUserService = mock(UserService);
    mockGlobalEmitter = mock(GlobalEmitter);
    service = new RewardsService(
      mockClient,
      instance(mockAlgorand),
      instance(mockRewardsRepository),
      instance(mockAlgoStdAssetsService),
      instance(mockUserService),
      instance(mockGlobalEmitter),
    );
  });

  afterEach(() => {
    reset(mockAlgorand);
    reset(mockRewardsRepository);
    reset(mockAlgoStdAssetsService);
    reset(mockUserService);
    reset(mockGlobalEmitter);
  });
  it('handles EmitLoadTemporaryTokens event correctly', () => {
    const spyOnService = spy(service);
    when(spyOnService.loadTemporaryTokens(anything(), anything())).thenResolve();
    const eventData = { discordUserId, walletAddress };

    // Simulate the event being emitted and handle it in the service
    when(mockGlobalEmitter.onEvent(GlobalEvent.EmitLoadTemporaryTokens, anyFunction())).thenCall(
      (_event, handler) => {
        handler(eventData);
      },
    );

    service['createEmitters']();

    verify(spyOnService.loadTemporaryTokens(discordUserId, walletAddress)).once();
  });

  describe('issueTemporaryTokens', () => {
    it('should issue temporary tokens because opted in', async () => {
      when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
        optedIn: true,
        tokens: amount,
      });
      when(
        mockRewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount),
      ).thenResolve(amount);

      const result = await service.issueTemporaryTokens(
        discordUserId,
        walletAddress,
        asaId,
        amount,
      );

      verify(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).once();
      verify(
        mockRewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount),
      ).once();

      expect(result).toEqual(amount);
    });
    it('should not issue temporary tokens because not opted in', async () => {
      when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
        optedIn: false,
        tokens: amount,
      });

      const result = await service.issueTemporaryTokens(
        discordUserId,
        walletAddress,
        asaId,
        amount,
      );

      verify(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).once();
      verify(
        mockRewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, amount),
      ).never();

      expect(result).toBeUndefined();
    });
    describe('getAllRewardTokensByWallet', () => {
      it('should get all reward tokens by wallet', async () => {
        when(mockRewardsRepository.getAllRewardTokensByWallet(walletAddress)).thenResolve([
          fakeReward,
        ] as unknown as Reward[]);

        const result = await service.getAllRewardTokensByWallet(walletAddress);

        verify(mockRewardsRepository.getAllRewardTokensByWallet(walletAddress)).once();

        expect(result).toEqual([fakeReward]);
      });
      it('should return empty array if no rewards', async () => {
        when(mockRewardsRepository.getAllRewardTokensByWallet(walletAddress)).thenResolve([]);

        const result = await service.getAllRewardTokensByWallet(walletAddress);

        verify(mockRewardsRepository.getAllRewardTokensByWallet(walletAddress)).once();

        expect(result).toEqual([]);
      });
    });
    describe('getAllRewardsTokensForUserByAsset', () => {
      it('should get all reward tokens for user by asset', async () => {
        when(mockRewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId)).thenResolve(
          [fakeReward],
        );
        when(mockUserService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
        const result = await service.getAllRewardsTokensForUserByAsset(discordUserId, asaId);

        verify(mockRewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId)).once();

        expect(result).toEqual([fakeReward]);
      });
      it('should return empty array if no rewards', async () => {
        const spyLoadWalletsAndReturnAssets = spy(service);
        when(
          spyLoadWalletsAndReturnAssets.loadAllWalletsAndReturnAssets(
            anything(),
            anything(),
            anything(),
          ),
        ).thenResolve([]);
        when(mockRewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId)).thenResolve(
          [],
        );
        when(mockUserService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
        const result = await service.getAllRewardsTokensForUserByAsset(discordUserId, asaId);

        verify(mockRewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId)).once();

        expect(result).toEqual([]);
      });
    });
    describe('loadAllWalletsAndReturnAssets', () => {
      it('should load all wallets and return assets', async () => {
        const spyLoadTemporaryTokensForAllWallets = spy(service);
        when(
          spyLoadTemporaryTokensForAllWallets.loadTemporaryTokensForAllWallets(
            anything(),
            anything(),
            anything(),
          ),
        ).thenResolve(amount);
        when(mockRewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId)).thenResolve(
          [fakeReward],
        );
        when(mockUserService.getUserWallets(discordUserId)).thenResolve([walletAddress]);
        const result = await service.loadAllWalletsAndReturnAssets(
          discordUserId,
          [walletAddress],
          asaId,
        );

        verify(mockRewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId)).once();

        expect(result).toEqual([fakeReward]);
      });
    });
    describe('loadTemporaryTokensForAllWallets', () => {
      it('should load temporary tokens for all wallets', async () => {
        when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: amount,
        });
        when(
          mockRewardsRepository.updateTemporaryTokens(
            discordUserId,
            walletAddress,
            asaId,
            anything(),
          ),
        ).thenResolve(amount);

        const result = await service.loadTemporaryTokensForAllWallets(
          discordUserId,
          [walletAddress],
          asaId,
        );

        verify(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).once();
        verify(
          mockRewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, 0),
        ).once();

        expect(result).toBe(amount);
      });
      it('should not load temporary tokens for all wallets because not opted in', async () => {
        when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
          optedIn: false,
          tokens: amount,
        });

        const result = await service.loadTemporaryTokensForAllWallets(
          discordUserId,
          [walletAddress],
          asaId,
        );

        verify(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).once();
        verify(
          mockRewardsRepository.updateTemporaryTokens(discordUserId, walletAddress, asaId, 0),
        ).never();

        expect(result).toBe(0);
      });
    });
    describe('getWalletsByUserAndAssetWithUnclaimedTokens', () => {
      it('should get wallets by user and asset with unclaimed tokens', async () => {
        when(
          mockRewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
            anything(),
            anything(),
            anything(),
          ),
        ).thenResolve([fakeReward]);

        const result = await service.getWalletsByUserAndAssetWithUnclaimedTokens(
          discordUserId,
          asaId,
        );

        verify(
          mockRewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
            anything(),
            anything(),
            anything(),
          ),
        ).once();

        expect(result).toEqual([fakeReward]);
      });
      it('should return nothing because we have no wallets with unclaimed', async () => {
        when(
          mockRewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
            asaId,
            0,
            discordUserId,
          ),
        ).thenResolve([]);

        const result = await service.getWalletsByUserAndAssetWithUnclaimedTokens(
          discordUserId,
          asaId,
        );

        verify(
          mockRewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
            asaId,
            0,
            discordUserId,
          ),
        ).once();

        expect(result).toEqual([]);
      });
    });
    describe('getAssetBalances', () => {
      it('should get asset balance for one wallet', async () => {
        when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: amount,
        });
        const result = await service.getAssetBalances([fakeReward], fakeStdAsset);
        expect(result).toEqual([expectedRewardTokenWallet]);
      });
      it('should get asset balance for multiple wallets', async () => {
        const expectedRewardTokenWallet2 = {
          convertedTokens: fakeReward2.temporaryTokens,
          discordUserId: fakeReward2.discordUserId,
          walletAddress: fakeReward2.walletAddress,
          asaId: fakeReward2.asaId,
          temporaryTokens: fakeReward2.temporaryTokens,
        } as RewardTokenWallet<WalletAddress>;
        when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: amount,
        });
        when(mockAlgorand.getTokenOptInStatus(fakeReward2.walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: fakeReward2.temporaryTokens,
        });
        const result = await service.getAssetBalances([fakeReward, fakeReward2], fakeStdAsset);
        expect(result).toEqual([expectedRewardTokenWallet, expectedRewardTokenWallet2]);
      });
    });
    describe('getRewardsTokenWalletWithMostTokens', () => {
      it('should get rewards token wallet with most tokens for one wallet', async () => {
        const spyGetAllRewardsTokensForUserByAsset = spy(service);
        when(
          spyGetAllRewardsTokensForUserByAsset.getAllRewardsTokensForUserByAsset(
            discordUserId,
            asaId,
          ),
        ).thenResolve([fakeReward]);
        when(mockAlgoStdAssetsService.getStdAssetByAssetIndex(asaId)).thenResolve(fakeStdAsset);
        when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: amount,
        });
        const result = await service.getRewardsTokenWalletWithMostTokens(discordUserId, asaId);
        expect(result).toEqual(expectedRewardTokenWallet);
      });
      it('should get rewards token wallet with most tokens for multiple wallets', async () => {
        const expectedRewardTokenWallet2 = {
          convertedTokens: fakeReward2.temporaryTokens,
          discordUserId: fakeReward2.discordUserId,
          walletAddress: fakeReward2.walletAddress,
          asaId: fakeReward2.asaId,
          temporaryTokens: fakeReward2.temporaryTokens,
        } as RewardTokenWallet<WalletAddress>;

        const spyGetAllRewardsTokensForUserByAsset = spy(service);
        when(
          spyGetAllRewardsTokensForUserByAsset.getAllRewardsTokensForUserByAsset(
            discordUserId,
            asaId,
          ),
        ).thenResolve([fakeReward, fakeReward2]);
        when(mockAlgoStdAssetsService.getStdAssetByAssetIndex(asaId)).thenResolve(fakeStdAsset);
        when(mockAlgorand.getTokenOptInStatus(walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: amount,
        });
        when(mockAlgorand.getTokenOptInStatus(fakeReward2.walletAddress, asaId)).thenResolve({
          optedIn: true,
          tokens: fakeReward2.temporaryTokens,
        });
        const result = await service.getRewardsTokenWalletWithMostTokens(discordUserId, asaId);
        expect(result).toEqual(expectedRewardTokenWallet2);
      });
    });
    describe('loadTemporaryTokens', () => {
      it('should load temporary tokens', async () => {
        const spyIssueTemporaryTokens = spy(service);
        when(
          spyIssueTemporaryTokens.issueTemporaryTokens(
            anything(),
            anything(),
            anything(),
            anything(),
          ),
        ).thenResolve(amount);
        when(mockAlgoStdAssetsService.getAllStdAssets()).thenResolve([fakeStdAsset]);
        const result = await service.loadTemporaryTokens(discordUserId, walletAddress);
        expect(result).toBeUndefined();
        verify(mockAlgoStdAssetsService.getAllStdAssets()).once();
        verify(
          spyIssueTemporaryTokens.issueTemporaryTokens(
            discordUserId,
            walletAddress,
            fakeStdAsset._id,
            0,
          ),
        ).once();
      });
    });
    describe('removeUnclaimedTokensFromWallet', () => {
      const mockWalletWithUnclaimedAssets = {
        walletAddress,
        unclaimedTokens: amount,
        discordUserId,
      } as WalletWithUnclaimedAssets;
      it('should remove unclaimed tokens from one wallet', async () => {
        const spyIssueTemporaryTokens = spy(service);
        when(
          spyIssueTemporaryTokens.issueTemporaryTokens(
            anything(),
            anything(),
            anything(),
            anything(),
          ),
        ).thenResolve(amount);
        const result = await service.removeUnclaimedTokensFromWallet(
          mockWalletWithUnclaimedAssets,
          fakeStdAsset,
        );
        expect(result).toBeUndefined();
        verify(
          spyIssueTemporaryTokens.issueTemporaryTokens(
            discordUserId,
            walletAddress,
            fakeStdAsset._id,
            -amount,
          ),
        ).once();
      });
    });
    describe('fetchWalletsWithUnclaimedAssets', () => {
      it('should fetch wallets with unclaimed assets', async () => {
        when(
          mockRewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(asaId, 0),
        ).thenResolve([fakeReward]);
        const result = await service.fetchWalletsWithUnclaimedAssets(0, fakeStdAsset);
        expect(result).toEqual([
          {
            discordUserId: fakeReward.discordUserId,
            unclaimedTokens: fakeReward.temporaryTokens,
            walletAddress: fakeReward.walletAddress,
          },
        ]);
      });
    });
  });
  describe('Covers for Algorand', () => {
    describe('dispenseAssetToUser', () => {
      it('should dispense asset to user', async () => {
        when(mockAlgorand.claimToken(anything())).thenResolve({} as ClaimTokenResponse);
        const result = await service.dispenseAssetToUser(asaId, amount, walletAddress);
        expect(result).toEqual({});
      });
    });
    describe('tipTokens', () => {
      it('should tip tokens', async () => {
        when(mockAlgorand.tipToken(anything())).thenResolve({} as ClaimTokenResponse);
        const result = await service.tipTokens(asaId, amount, walletAddress, walletAddress);
        expect(result).toEqual({});
      });
    });
  });
  describe('Token Claim Functions', () => {
    describe('claimUnclaimedTokens', () => {
      const mockedUser = mockedClient.getUser();

      const mockWalletWithUnclaimedAssets = {
        walletAddress,
        unclaimedTokens: amount,
        discordUserId: mockedUser.id as DiscordId,
      } as WalletWithUnclaimedAssets;
      it('should claim unclaimed tokens', async () => {
        const spyRemoveUnclaimedTokensFromWallet = spy(service);
        when(mockAlgorand.claimToken(anything())).thenResolve({
          txId: '123',
        } as ClaimTokenResponse);
        when(
          spyRemoveUnclaimedTokensFromWallet.removeUnclaimedTokensFromWallet(
            anything(),
            anything(),
          ),
        ).thenResolve();
        const result = await service.claimUnclaimedTokens(
          mockWalletWithUnclaimedAssets,
          fakeStdAsset,
        );
        expect(result).toMatchObject({ txId: '123' });
        verify(
          spyRemoveUnclaimedTokensFromWallet.removeUnclaimedTokensFromWallet(
            mockWalletWithUnclaimedAssets,
            fakeStdAsset,
          ),
        ).once();
      });
      it('should return error when claim fails', async () => {
        const spyRemoveUnclaimedTokensFromWallet = spy(service);
        when(mockAlgorand.claimToken(anything())).thenResolve({
          error: 'error',
        } as ClaimTokenResponse);
        when(
          spyRemoveUnclaimedTokensFromWallet.removeUnclaimedTokensFromWallet(
            anything(),
            anything(),
          ),
        ).thenResolve();
        const result = await service.claimUnclaimedTokens(
          mockWalletWithUnclaimedAssets,
          fakeStdAsset,
        );
        expect(result).toMatchObject({ error: 'Claim failed: error' });
        verify(
          spyRemoveUnclaimedTokensFromWallet.removeUnclaimedTokensFromWallet(
            mockWalletWithUnclaimedAssets,
            fakeStdAsset,
          ),
        ).never();
      });
    });
    describe('batchTransActionProcessor', () => {
      const mockedUser = mockedClient.getUser();

      const mockWalletWithUnclaimedAssets = {
        walletAddress,
        unclaimedTokens: amount,
        discordUserId: mockedUser.id as DiscordId,
      } as WalletWithUnclaimedAssets;
      it('should just return empty array if no wallets', async () => {
        const result = await service.batchTransActionProcessor([], fakeStdAsset);
        expect(result).toStrictEqual([]);
      });
      it('should batch transaction processor', async () => {
        const spyClaimUnclaimedTokens = spy(service);
        when(spyClaimUnclaimedTokens.claimUnclaimedTokens(anything(), anything())).thenResolve(
          {} as ClaimTokenResponse,
        );
        const result = await service.batchTransActionProcessor(
          [mockWalletWithUnclaimedAssets],
          fakeStdAsset,
        );
        expect(result).toEqual([{}]);
        verify(
          spyClaimUnclaimedTokens.claimUnclaimedTokens(mockWalletWithUnclaimedAssets, fakeStdAsset),
        ).once();
      });
      it('should return multiple claim responses', async () => {
        const spyClaimUnclaimedTokens = spy(service);
        when(spyClaimUnclaimedTokens.claimUnclaimedTokens(anything(), anything())).thenResolve({
          txId: '123',
        } as ClaimTokenResponse);
        const result = await service.batchTransActionProcessor(
          [mockWalletWithUnclaimedAssets, mockWalletWithUnclaimedAssets],
          fakeStdAsset,
        );
        expect(result).toEqual([{ txId: '123' }, { txId: '123' }]);
        verify(
          spyClaimUnclaimedTokens.claimUnclaimedTokens(mockWalletWithUnclaimedAssets, fakeStdAsset),
        ).twice();
      });
    });
  });
});
