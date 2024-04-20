import { Client, Discord } from 'discordx';

import { inject, injectable, singleton } from 'tsyringe';

import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { RewardsRepository } from '../database/rewards/rewards.repo.js';
import { Reward } from '../database/rewards/rewards.schema.js';
import { GlobalEmitter } from '../emitters/global-emitter.js';
import { GlobalEvent } from '../emitters/types.js';
import {
  TransactionResultOrError,
  UnclaimedAsset,
  WalletWithUnclaimedAssets,
} from '../types/algorand.js';
import {
  DiscordId,
  ReceiverWalletAddress,
  RewardTokenWallet,
  SenderWalletAddress,
  WalletAddress,
} from '../types/core.js';
import { ChannelUtils } from '../utils/classes/channel-utils.js';
import { ObjectUtil } from '../utils/classes/object-utils.js';
import { karmaClaimWebHook } from '../utils/functions/web-hooks.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';
import { isTransferError } from './algorand.errorprocessor.js';
import { Algorand } from './algorand.js';
import { UserService } from './user.js';

@Discord()
@singleton()
@injectable()
export class RewardsService {
  constructor(
    private client: Client,
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
  }
  async issueTemporaryTokens(
    discordUserId: DiscordId,
    walletAddress: WalletAddress,
    asaId: number,
    amount: number,
  ): Promise<number | undefined> {
    const { optedIn: isOptedIn } = await this.algorand.getTokenOptInStatus(walletAddress, asaId);

    if (!isOptedIn) {
      return;
    }

    return await this.rewardsRepository.updateTemporaryTokens(
      discordUserId,
      walletAddress,
      asaId,
      amount,
    );
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
    return assets.filter((asset) => userWallets.includes(asset.walletAddress));
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
  ): Promise<Reward[] | []> {
    return await this.rewardsRepository.getWalletsWithTemporaryTokensAboveThreshold(
      asaId,
      0,
      discordUserId,
    );
  }

  async getAssetBalances<T extends WalletAddress | ReceiverWalletAddress | SenderWalletAddress>(
    assets: Reward[],
    stdAsset: AlgoStdAsset,
  ): Promise<Array<RewardTokenWallet<T>>> {
    return await Promise.all(
      assets.map(async (asset) => {
        const { tokens } = await this.algorand.getTokenOptInStatus(
          asset.walletAddress,
          asset.asaId,
        );
        const convertedTokens = ObjectUtil.convertBigIntToNumber(tokens, stdAsset.decimals);
        const hydratedObject = asset.toObject();
        return {
          ...hydratedObject,
          convertedTokens,
          walletAddress: asset.walletAddress as T,
        };
      }),
    );
  }

  async getRewardsTokenWalletWithMostTokens<
    T extends WalletAddress | ReceiverWalletAddress | SenderWalletAddress,
  >(discordUserId: DiscordId, asaId: number): Promise<RewardTokenWallet<T> | undefined> {
    const assets = await this.getAllRewardsTokensForUserByAsset(discordUserId, asaId);
    const stdAsset = await this.algoStdAssetsService.getStdAssetByAssetIndex(asaId);
    const assetBalances = await this.getAssetBalances<T>(assets, stdAsset);

    // return the wallet with the most tokens
    return assetBalances.sort((a, b) => b.convertedTokens - a.convertedTokens)[0];
  }

  async loadTemporaryTokens(discordUserId: DiscordId, walletAddress: WalletAddress): Promise<void> {
    const gameTokens = await this.algoStdAssetsService.getAllStdAssets();
    for (const token of gameTokens) {
      await this.issueTemporaryTokens(discordUserId, walletAddress, token._id, 0);
    }
  }
  async removeUnclaimedTokensFromWallet(
    walletWithUnclaimedAssets: WalletWithUnclaimedAssets,
    unclaimedAsset: UnclaimedAsset,
  ): Promise<void> {
    await this.issueTemporaryTokens(
      walletWithUnclaimedAssets.discordUserId,
      walletWithUnclaimedAssets.walletAddress,
      unclaimedAsset._id,
      -walletWithUnclaimedAssets.unclaimedTokens,
    );
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
    return walletsWithUnclaimedAssets;
  }
  async dispenseAssetToUser(
    assetIndex: number,
    amount: number,
    receiverAddress: ReceiverWalletAddress,
  ): Promise<TransactionResultOrError> {
    return await this.algorand.claimToken({
      assetIndex: assetIndex,
      amount: amount,
      receiverAddress: receiverAddress,
    });
  }
  async tipTokens(
    assetIndex: number,
    amount: number,
    receiverAddress: ReceiverWalletAddress,
    senderAddress: SenderWalletAddress,
  ): Promise<TransactionResultOrError> {
    return await this.algorand.tipToken({
      assetIndex: assetIndex,
      amount: amount,
      receiverAddress: receiverAddress,
      senderAddress: senderAddress,
    });
  }

  async claimUnclaimedTokens(
    walletWithUnclaimedAssets: WalletWithUnclaimedAssets,
    asset: UnclaimedAsset,
  ): Promise<TransactionResultOrError> {
    const userGuildMember = await ChannelUtils.getGuildMemberByDiscordId(
      walletWithUnclaimedAssets.discordUserId,
      this.client,
    );
    const claimStatus = await this.algorand.claimToken({
      assetIndex: asset._id,
      receiverAddress: walletWithUnclaimedAssets.walletAddress,
      amount: walletWithUnclaimedAssets.unclaimedTokens,
    });
    if (!isTransferError(claimStatus) && claimStatus.transaction.txID()) {
      // Remove the unclaimed tokens from the wallet
      await this.removeUnclaimedTokensFromWallet(walletWithUnclaimedAssets, asset);
      karmaClaimWebHook(claimStatus, userGuildMember);
    }
    return claimStatus;
  }
  async batchTransActionProcessor(
    walletsWithUnclaimedAssets: WalletWithUnclaimedAssets[],
    asset: UnclaimedAsset,
  ): Promise<void> {
    if (walletsWithUnclaimedAssets.length === 0) {
      return;
    }
    for (const wallet of walletsWithUnclaimedAssets) {
      await this.claimUnclaimedTokens(wallet, asset);
    }
  }
}
