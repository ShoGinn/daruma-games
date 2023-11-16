import { container } from 'tsyringe';

import {
  AlgoNFTAsset,
  IAlgoNFTAsset,
} from '../../database/algo-nft-asset/algo-nft-asset.schema.js';
import { convertToPlainObject } from '../../database/mongoose.js';
import { DatabaseUser, IUser } from '../../database/user/user.schema.js';
import { gameNPCs } from '../../enums/daruma-training.js';
import { AlgoNFTAssetService } from '../../services/algo-nft-assets.js';
import { RewardsService } from '../../services/rewards.js';
import type {
  GameWinInfo,
  IGameStats,
  PlayerDiceRolls,
  PlayerRoundsData,
} from '../../types/daruma-training.js';
import { rollForCoolDown } from '../functions/dt-utils.js';
import logger from '../functions/logger-factory.js';

import { PlayerDice } from './dt-player-dice.js';

/**
 * Player Class
 * Represents a player registered in an active game
 */
export class Player {
  public roundsData: PlayerRoundsData;
  public rollsData: PlayerDiceRolls;
  public dbUser;
  public isWinner: boolean;
  public playableNFT: IAlgoNFTAsset;
  public gameAssetIndex: number;
  public randomCoolDown: number;
  public coolDownModified: boolean;
  constructor(
    databaseUser: DatabaseUser | IUser,
    playableNFT: AlgoNFTAsset,
    gameAssetIndex: number,
  ) {
    const playerGameData = PlayerDice.completeGameForPlayer();
    this.roundsData = playerGameData.roundsData;
    this.rollsData = playerGameData.diceRolls;
    this.dbUser = convertToPlainObject(databaseUser);
    this.playableNFT = convertToPlainObject(playableNFT);
    this.gameAssetIndex = gameAssetIndex;
    this.isWinner = false;
    this.randomCoolDown = 0;
    this.coolDownModified = false;
  }
  public get isNpc(): boolean {
    return gameNPCs.some((npc) => npc.assetIndex === this.playableNFT._id);
  }

  /**
   * Update the user and asset after the game ends
   *
   * @param {GameWinInfo} gameWinInfo
   * @param {number} coolDown
   * @returns {*}  {Promise<void>}
   * @memberof Player
   */
  async userAndAssetEndGameUpdate(gameWinInfo: GameWinInfo, coolDown: number): Promise<void> {
    if (this.isNpc) {
      return;
    }
    try {
      // Increment the wins and losses
      const finalStats: IGameStats = {
        wins: this.isWinner ? 1 : 0,
        losses: this.isWinner ? 0 : 1,
        // if winner and game.zen : zen is true
        zen: this.isWinner && gameWinInfo.zen ? 1 : 0,
      };
      // Roll for a random cooldown
      this.randomCoolDown = await rollForCoolDown(this.playableNFT, this.dbUser._id, coolDown);
      this.coolDownModified = this.randomCoolDown !== coolDown;
      await this.updateAsset(finalStats);
      await this.updateWinner(gameWinInfo.payout);
    } catch (error) {
      logger.error('Error during userAndAssetEndGameUpdate:', error);
      throw error;
    }
  }
  async updateAsset(finalStats: IGameStats): Promise<void> {
    const algoNFTAssetService = container.resolve(AlgoNFTAssetService);
    const updatedAsset = await algoNFTAssetService.assetEndGameUpdate(
      this.playableNFT._id,
      this.randomCoolDown,
      finalStats,
    );
    if (updatedAsset) {
      this.playableNFT = updatedAsset;
    }
  }

  async updateWinner(payout: number): Promise<void> {
    if (this.isWinner) {
      const algoNFTAssetService = container.resolve(AlgoNFTAssetService);
      const rewardsService = container.resolve(RewardsService);
      const ownerWallet = await algoNFTAssetService.getOwnerWalletFromAssetIndex(
        this.playableNFT._id,
      );
      await rewardsService.issueTemporaryTokens(
        this.dbUser._id,
        ownerWallet,
        this.gameAssetIndex,
        payout,
      );
    }
  }
}
