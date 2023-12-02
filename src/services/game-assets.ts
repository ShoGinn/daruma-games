import { Client } from 'discordx';

import { inject, injectable, singleton } from 'tsyringe';

import { getConfig } from '../config/config.js';
import { lowTokenAmounts } from '../core/constants.js';
import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { PostConstruct } from '../decorators/post-construct.js';
import { TransactionResultOrError } from '../types/algorand.js';
import { ReceiverWalletAddress, SenderWalletAddress, WalletAddress } from '../types/core.js';
import { ChannelUtils } from '../utils/classes/channel-utils.js';
import logger from '../utils/functions/logger-factory.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';
import { isTransferError } from './algorand.errorprocessor.js';
import { Algorand } from './algorand.js';

type AssetTarget = 'karmaAsset' | 'enlightenmentAsset';

@singleton()
@injectable()
export class GameAssets {
  constructor(
    @inject(AlgoStdAssetsService) private algoStdAssetService: AlgoStdAssetsService,
    @inject(Algorand) private algorand: Algorand,
  ) {}

  private initializedAssets = new Map<AssetTarget, AlgoStdAsset>();

  private getAsset(assetTarget: AssetTarget): AlgoStdAsset {
    const asset = this.initializedAssets.get(assetTarget);
    if (!asset) {
      throw new Error(`${assetTarget} has not been initialized yet!`);
    }
    return asset;
  }

  public get karmaAsset(): AlgoStdAsset {
    return this.getAsset('karmaAsset');
  }

  public get enlightenmentAsset(): AlgoStdAsset {
    return this.getAsset('enlightenmentAsset');
  }
  public isReady(): boolean {
    return this.initializedAssets.size === 2;
  }

  private async initializeAsset(assetName: string, targetProperty: AssetTarget): Promise<boolean> {
    try {
      const asset = await this.algoStdAssetService.getStdAssetByUnitName(assetName);
      this.initializedAssets.set(targetProperty, asset);
      return true;
    } catch {
      logger.error(`Failed to get the necessary asset (${assetName}) from the database`);
      return false;
    }
  }
  private async checkAssetBalance(
    client: Client,
    asset: AlgoStdAsset,
    lowTokenAmount: number,
    refillAddress?: WalletAddress,
  ): Promise<void> {
    refillAddress = refillAddress ?? (this.algorand.claimTokenAccount.addr as WalletAddress);
    const assetStatus = await this.algorand.getTokenOptInStatus(refillAddress, asset._id);

    if (assetStatus.tokens < lowTokenAmount) {
      await ChannelUtils.sendTokenLowMessageToDevelopers(
        client,
        asset.name,
        lowTokenAmount,
        assetStatus.tokens,
      );

      if (asset.name === this.karmaAsset.name) {
        await this.attemptKarmaReplenish(client);
      }
    }
  }

  public async checkAlgoNetworkBalances(client: Client): Promise<void> {
    await this.checkAssetBalance(client, this.karmaAsset, lowTokenAmounts.karmaAsset);
    await this.checkAssetBalance(
      client,
      this.enlightenmentAsset,
      lowTokenAmounts.enlightenmentAsset,
    );
  }
  private getReplenishDetails(
    refillAddress?: ReceiverWalletAddress,
    replenishTokenAddress?: SenderWalletAddress,
    replenishAmount?: number,
  ): {
    refillAddress: ReceiverWalletAddress;
    replenishTokenAddress: SenderWalletAddress;
    replenishAmount: number;
  } {
    replenishTokenAddress =
      replenishTokenAddress ?? (getConfig().get('replenishTokenAddress') as SenderWalletAddress);
    if (!replenishTokenAddress) {
      throw new Error('Replenish Token Account Not Found');
    }
    replenishAmount = replenishAmount ?? lowTokenAmounts.karmaAssetReplenishAmount;
    refillAddress =
      refillAddress ?? (this.algorand.claimTokenAccount.addr as ReceiverWalletAddress);
    return { refillAddress, replenishTokenAddress, replenishAmount };
  }

  private async sendReplenishMessage(
    client: Client,
    replenishTokenAccount: SenderWalletAddress,
    replenishAmount: number,
  ): Promise<void> {
    await ChannelUtils.sendMessageToAdminChannel(
      `Attempting to Replenish ${this.karmaAsset
        ?.name} Tokens From -- Account: ${replenishTokenAccount} -- Amount: ${replenishAmount.toLocaleString()}`,
      client,
    );
  }

  private async handleReplenishResult(
    client: Client,
    replenishTxn: TransactionResultOrError,
  ): Promise<void> {
    await (!isTransferError(replenishTxn) && replenishTxn.transaction.txID()
      ? ChannelUtils.sendMessageToAdminChannel(
          `Replenished ${this.karmaAsset
            ?.name} Tokens -- Txn ID: ${replenishTxn.transaction.txID()} -- Amount: ${replenishTxn.transaction?.amount?.toLocaleString()}`,
          client,
        )
      : ChannelUtils.sendMessageToAdminChannel(
          `Failed to Replenish ${this.karmaAsset?.name} Tokens`,
          client,
        ));
  }

  public async attemptKarmaReplenish(
    client: Client,
    refillAddress?: ReceiverWalletAddress,
    replenishTokenAddress?: SenderWalletAddress,
    replenishAmount?: number,
  ): Promise<void> {
    try {
      const {
        refillAddress: finalRefillAddress,
        replenishTokenAddress: finalReplenishTokenAddress,
        replenishAmount: finalReplenishAmount,
      } = this.getReplenishDetails(refillAddress, replenishTokenAddress, replenishAmount);
      await this.sendReplenishMessage(client, finalReplenishTokenAddress, finalReplenishAmount);
      const replenishTxn = await this.algorand.tipToken({
        assetIndex: this.karmaAsset._id,
        amount: finalReplenishAmount,
        receiverAddress: finalRefillAddress,
        senderAddress: finalReplenishTokenAddress,
      });
      await this.handleReplenishResult(client, replenishTxn);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(error);
      }
    }
  }

  @PostConstruct
  public initializeAll(): Promise<[PromiseSettledResult<boolean>, PromiseSettledResult<boolean>]> {
    const gameAssetsConfig = getConfig().get('gameAssets');
    logger.info('Initializing Game Assets');
    return Promise.allSettled([
      this.initializeAsset(gameAssetsConfig.karma, 'karmaAsset'),
      this.initializeAsset(gameAssetsConfig.enlightenment, 'enlightenmentAsset'),
    ]);
  }
}
