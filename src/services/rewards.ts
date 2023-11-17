import { inject, injectable, singleton } from 'tsyringe';

import { RewardsRepository } from '../database/rewards/rewards.repo.js';
import { Reward } from '../database/rewards/rewards.schema.js';
import { GlobalEmitter } from '../emitters/global-emitter.js';
import { GlobalEvent } from '../emitters/types.js';
import { UnclaimedAsset, WalletWithUnclaimedAssets } from '../types/algorand.js';
import {
  DiscordId,
  ReceiverWalletAddress,
  SenderWalletAddress,
  WalletAddress,
} from '../types/core.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';
import logger from '../utils/functions/logger-factory.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';
import { Algorand } from './algorand.js';
import { UserService } from './user.js';

@singleton()
@injectable()
export class RewardsService {
  constructor(
    @inject(Algorand) private algorand: Algorand,
    @inject(RewardsRepository) private rewardsRepository: RewardsRepository,
    @inject(AlgoStdAssetsService) private algoStdAssetsService: AlgoStdAssetsService,
    @inject(UserService) private userService: UserService,
    @inject(GlobalEmitter) private globalEmitter: GlobalEmitter,
  ) {
    this.createEmitters();
  }
  private createEmitters(): void {
    this.globalEmitter.onEvent<{ discordUserId: DiscordId; walletAddress: string }>(
      GlobalEvent.EmitLoadTemporaryTokens,
      (data) => {
        return this.loadTemporaryTokens(data.discordUserId, data.walletAddress);
      },
    );

    this.globalEmitter.onEvent<{
      wallets: WalletWithUnclaimedAssets[];
      assetIndex: UnclaimedAsset;
    }>(GlobalEvent.EmitRemoveUnclaimedTokensFromMultipleWallets, (data) => {
      return this.removeUnclaimedTokensFromMultipleWallets(data.wallets, data.assetIndex);
    });
  }
  async issueTemporaryTokens(
    discordUserId: DiscordId,
    walletAddress: WalletAddress,
    asaId: number,
    amount: number,
  ): Promise<number | undefined> {
    const { optedIn: isOptedIn } = await this.algorand.getTokenOptInStatus(walletAddress, asaId);

    if (!isOptedIn) {
      logger.debug(`User ${discordUserId} is not opted into ASA ${asaId}.`);
      return;
    }

    const reward = await this.rewardsRepository.updateTemporaryTokens(
      discordUserId,
      walletAddress,
      asaId,
      amount,
    );
    logger.debug(
      `Updated temporary tokens for asa: ${asaId} user: ${discordUserId} amount:${reward}`,
    );
    return reward;
  }

  async getAllRewardTokensByWallet(walletAddress: WalletAddress): Promise<Reward[]> {
    return await this.rewardsRepository.getAllRewardTokensByWallet(walletAddress);
  }
  async getAllRewardsTokensForUserByAsset(
    discordUserId: DiscordId,
    asaId: number,
  ): Promise<Reward[]> {
    let assets: Reward[] = [];
    assets = await this.rewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId);
    const userWallets = await this.userService.getUserWallets(discordUserId);
    if (assets.length === 0) {
      assets = await this.loadAllWalletsAndReturnAssets(discordUserId, userWallets, asaId);
    }
    const filteredAssets = assets.filter((asset) => userWallets.includes(asset.walletAddress));
    return filteredAssets;
  }
  async loadAllWalletsAndReturnAssets(
    discordUserId: DiscordId,
    walletAddress: WalletAddress[],
    asaId: number,
  ): Promise<Reward[]> {
    await this.loadTemporaryTokensForAllWallets(discordUserId, walletAddress, asaId);
    return await this.rewardsRepository.getRewardsByDiscordUserAndAsa(discordUserId, asaId);
  }
  async loadTemporaryTokensForAllWallets(
    discordUserId: DiscordId,
    walletAddress: WalletAddress[],
    asaId: number,
  ): Promise<number> {
    let totalTokens = 0;
    for (const wallet of walletAddress) {
      totalTokens += (await this.issueTemporaryTokens(discordUserId, wallet, asaId, 0)) ?? 0;
    }
    return totalTokens;
  }
  async getWalletsByUserAndAssetWithUnclaimedTokens(
    discordUserId: DiscordId,
    asaId: number,
  ): Promise<Reward[]> {
    const asset = await this.rewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
      asaId,
      0,
      discordUserId,
    );
    return asset;
  }
  async getRewardsTokenWalletWithMostTokens<
    T extends WalletAddress | ReceiverWalletAddress | SenderWalletAddress,
  >(
    discordUserId: DiscordId,
    asaId: number,
  ): Promise<
    | {
        convertedTokens: number;
        discordUserId: DiscordId;
        walletAddress: T;
        asaId: number;
        temporaryTokens: number;
      }
    | undefined
  > {
    const assets = await this.getAllRewardsTokensForUserByAsset(discordUserId, asaId);
    const stdAsset = await this.algoStdAssetsService.getStdAssetByAssetIndex(asaId);
    const assetBalances = await Promise.all(
      assets.map(async (asset) => {
        const { tokens } = await this.algorand.getTokenOptInStatus(
          asset.walletAddress,
          asset.asaId,
        );
        const convertedTokens = ObjectUtil.convertBigIntToNumber(tokens, stdAsset.decimals);
        const hydratedAsset = asset;
        return {
          ...hydratedAsset.toObject(),
          convertedTokens,
          walletAddress: asset.walletAddress as T,
        };
      }),
    );

    // return the wallet with the most tokens
    return assetBalances.sort((a, b) => b.convertedTokens - a.convertedTokens)[0];
  }
  async loadTemporaryTokens(discordUserId: DiscordId, walletAddress: WalletAddress): Promise<void> {
    const gameTokens = await this.algoStdAssetsService.getAllStdAssets();
    for (const token of gameTokens) {
      await this.issueTemporaryTokens(discordUserId, walletAddress, token._id, 0);
    }
  }
  async removeUnclaimedTokensFromMultipleWallets(
    chunk: WalletWithUnclaimedAssets[],
    unclaimedAsset: UnclaimedAsset,
  ): Promise<void> {
    for (const wallet of chunk) {
      await this.issueTemporaryTokens(
        wallet.discordUserId,
        wallet.walletAddress,
        unclaimedAsset._id,
        -wallet.unclaimedTokens,
      );
    }
  }

  async fetchWalletsWithUnclaimedAssets(
    claimThreshold: number,
    unclaimedAsset: UnclaimedAsset,
  ): Promise<WalletWithUnclaimedAssets[]> {
    const rewards = await this.rewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
      unclaimedAsset._id,
      claimThreshold,
    );
    const walletsWithUnclaimedAssets: WalletWithUnclaimedAssets[] = rewards.map((reward) => ({
      walletAddress: reward.walletAddress as ReceiverWalletAddress,
      unclaimedTokens: reward.temporaryTokens,
      discordUserId: reward.discordUserId,
    }));
    if (walletsWithUnclaimedAssets.length === 0) {
      logger.info(`No unclaimed ${unclaimedAsset.name} to claim`);
    }
    return walletsWithUnclaimedAssets;
  }
}
