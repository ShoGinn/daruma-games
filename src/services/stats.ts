import { inject, singleton } from 'tsyringe';

import { AlgoNFTAssetRepository } from '../database/algo-nft-asset/algo-nft-asset.repo.js';
import { AlgoNFTAsset, IAlgoNFTAsset } from '../database/algo-nft-asset/algo-nft-asset.schema.js';
import { DarumaTrainingCacheKeys } from '../enums/daruma-training.js';
import { DiscordId, WalletAddress } from '../types/core.js';
import { GameBonusData } from '../types/daruma-training.js';

import { CustomCache } from './custom-cache.js';
import { UserService } from './user.js';

@singleton()
export class StatsService {
  constructor(
    @inject(AlgoNFTAssetRepository) private algoNFTRepo: AlgoNFTAssetRepository,
    @inject(UserService) private userService: UserService,
    @inject(CustomCache) private cache: CustomCache,
  ) {}

  async topNFTHolders(): Promise<Map<string, number>> {
    let topNFTHolders = this.cache.get<Map<string, number>>(
      DarumaTrainingCacheKeys.TOP_NFT_HOLDERS,
    );
    if (!topNFTHolders) {
      const allUsers = await this.userService.getAllUsers();
      // create a user collection
      const userCounts = new Map<string, number>();
      for (const user of allUsers) {
        const userId = user._id;
        const allWallets = await this.userService.getUserWallets(userId);
        const assetCountByWallets = await this.getTotalAssetsByUser(userId, allWallets);
        // Count total NFT in wallet
        const totalNFT = allWallets.reduce((total) => total + assetCountByWallets, 0);
        if (totalNFT > 0) {
          userCounts.set(user._id, totalNFT);
        }
      }
      // Sort userCounts
      topNFTHolders = new Map([...userCounts.entries()].sort((a, b) => b[1] - a[1]));
      this.cache.set(DarumaTrainingCacheKeys.TOP_NFT_HOLDERS, topNFTHolders, 600);
    }
    return topNFTHolders;
  }
  /**
   * Sort the assets by their wins and losses
   * and return them sorted
   *
   * @returns {*}  {Promise<Array<AlgoNFTAsset>>}
   * @memberof AlgoNFTAssetRepository
   */
  async assetRankingByWinsTotalGames(): Promise<AlgoNFTAsset[]> {
    const timeout = 600; // 10 minutes
    const sortedAssets: AlgoNFTAsset[] | undefined = this.cache.get('rankedAssets');
    if (sortedAssets) {
      return sortedAssets;
    }
    const realWorldAssets = await this.algoNFTRepo.getAllAssets();
    const filteredAssets = realWorldAssets.filter(
      (asset) => asset.dojoWins !== 0 || asset.dojoLosses !== 0,
    );
    const totalWins = filteredAssets.reduce(
      (accumulator, asset) => accumulator + asset.dojoWins,
      0,
    );
    const totalLosses = filteredAssets.reduce(
      (accumulator, asset) => accumulator + asset.dojoLosses,
      0,
    );
    const totalGamesNew = totalWins + totalLosses;
    const sortedAssetsNew = filteredAssets.sort((a, b) => {
      const aWins: number = a.dojoWins;
      const aLosses: number = a.dojoLosses;

      const bWins: number = b.dojoWins;
      const bLosses: number = b.dojoLosses;

      if (aWins > bWins) {
        return -1;
      }
      if (aWins < bWins) {
        return 1;
      }

      return bWins / (bWins + bLosses) - aWins / (aWins + aLosses);
    });
    this.cache.set(DarumaTrainingCacheKeys.TOTAL_GAMES, totalGamesNew, timeout);
    this.cache.set('rankedAssets', sortedAssetsNew, timeout);

    return sortedAssetsNew;
  }
  async getBonusData(userAsset: IAlgoNFTAsset, userTotalAssets: number): Promise<GameBonusData> {
    let gameBonusData = this.cache.get<GameBonusData>('bonusStats');
    const rankedAssetsSorted = await this.assetRankingByWinsTotalGames();

    if (!gameBonusData) {
      const allPlayerAssets = await this.algoNFTRepo.getAllAssets();
      // Get the average total games played
      const totalWins = allPlayerAssets.reduce((accumulator, asset) => {
        return accumulator + asset.dojoWins;
      }, 0);
      const totalLosses = allPlayerAssets.reduce((accumulator, asset) => {
        return accumulator + asset.dojoLosses;
      }, 0);
      const totalGames = totalWins + totalLosses;
      let averageTotalGames = 0;
      let averageWins = 0;
      if (allPlayerAssets.length > 0) {
        averageTotalGames = totalGames / allPlayerAssets.length;
        // Get the average wins
        averageWins = totalWins / allPlayerAssets.length;
      }
      // get asset rankings
      const sumOfRanks = rankedAssetsSorted.reduce(
        (accumulator, _asset, index) => accumulator + index + 1,
        0,
      );
      const averageRank = Math.round(sumOfRanks / rankedAssetsSorted.length) || 1;

      // Round the numbers to 0 decimal places
      averageTotalGames = Math.round(averageTotalGames);
      averageWins = Math.round(averageWins);
      const averageTotalAssets = await this.getAverageDarumaOwned();
      // get each unique owner wallet and average out their total assets

      gameBonusData = {
        averageTotalGames,
        assetTotalGames: 0, // will be set later
        averageWins,
        assetWins: 0, // will be set later
        averageRank,
        assetRank: 0, // will be set later
        averageTotalAssets,
        userTotalAssets,
      };
      this.cache.set('bonusStats', gameBonusData, 600);
    }
    // get the asset rank of the user
    gameBonusData.assetRank =
      rankedAssetsSorted.findIndex((asset) => asset._id == userAsset._id) + 1;
    // get the asset total games
    gameBonusData.assetTotalGames = this.assetTotalGames(userAsset);
    // get the asset wins
    gameBonusData.assetWins = userAsset.dojoWins;

    gameBonusData.userTotalAssets = userTotalAssets;

    return gameBonusData;
  }
  async getTotalAssetsByUser(
    discordUserId: DiscordId,
    allWallets?: WalletAddress[],
  ): Promise<number> {
    if (!allWallets) {
      allWallets = await this.userService.getUserWallets(discordUserId);
    }
    return await this.algoNFTRepo.getAssetCountByWallets(allWallets);
  }
  async getTotalAssetsByWallet(walletAddress: WalletAddress): Promise<number> {
    return await this.algoNFTRepo.getAssetCountByWallets([walletAddress]);
  }
  /**
 * This function gets the average number of daruma owned by all users
 *

 * @returns {*}  {Promise<number>}
 */
  async getAverageDarumaOwned(): Promise<number> {
    const allUsersWithTotalAssets = await this.topNFTHolders();
    const arrayOfTotalAssets = [...allUsersWithTotalAssets.values()].filter(
      (v) => typeof v === 'number',
    );
    const totalAssets = arrayOfTotalAssets.reduce((a, b) => a + b, 0);
    return arrayOfTotalAssets.length > 0 ? Math.round(totalAssets / arrayOfTotalAssets.length) : 0;
  }
  /**
   *
   *
   * @param {IAlgoNFTAsset} asset
   * @returns {*}  {Promise<number>}
   * @memberof AlgoNFTAssetRepository
   */
  assetTotalGames(asset: IAlgoNFTAsset): number {
    return asset.dojoWins + asset.dojoLosses;
  }
}
