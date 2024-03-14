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
  async getAllAssetsCached(): Promise<AlgoNFTAsset[]> {
    return await this.cache.getFromCacheOrFetch(
      DarumaTrainingCacheKeys.ALL_ASSETS,
      () => this.algoNFTRepo.getAllAssets(),
      600,
    );
  }

  async topNFTHolders(): Promise<Map<string, number>> {
    return await this.cache.getFromCacheOrFetch(
      DarumaTrainingCacheKeys.TOP_NFT_HOLDERS,
      async () => {
        const allUsers = await this.userService.getAllUsers();
        const userCounts = new Map<string, number>();
        const promises = allUsers.map(async (user) => {
          const userId = user._id;
          const [allWallets, assetCountByWallets] = await Promise.all([
            this.userService.getUserWallets(userId),
            this.getTotalAssetsByUser(userId),
          ]);
          const totalNFT = allWallets.reduce((total) => total + assetCountByWallets, 0);
          if (totalNFT > 0) {
            userCounts.set(user._id, totalNFT);
          }
        });
        await Promise.all(promises);
        return new Map([...userCounts.entries()].sort((a, b) => b[1] - a[1]));
      },
      600,
    );
  }
  calculateTotalGames(assets: AlgoNFTAsset[]): {
    totalWins: number;
    totalLosses: number;
    totalGames: number;
  } {
    const totalWins = assets.reduce((accumulator, asset) => accumulator + asset.dojoWins, 0);
    const totalLosses = assets.reduce((accumulator, asset) => accumulator + asset.dojoLosses, 0);
    const totalGames = totalWins + totalLosses;
    this.cache.set(DarumaTrainingCacheKeys.TOTAL_GAMES, totalGames, 600);
    return { totalWins, totalLosses, totalGames };
  }
  sortAssetsByWinsAndLosses(assets: AlgoNFTAsset[]): AlgoNFTAsset[] {
    return assets.sort((a, b) => {
      if (a.dojoWins > b.dojoWins) {
        return -1;
      }
      if (a.dojoWins < b.dojoWins) {
        return 1;
      }
      return b.dojoWins / (b.dojoWins + b.dojoLosses) - a.dojoWins / (a.dojoWins + a.dojoLosses);
    });
  }

  async assetRankingByWinsTotalGames(): Promise<AlgoNFTAsset[]> {
    return await this.cache.getFromCacheOrFetch(
      DarumaTrainingCacheKeys.RANKED_ASSETS,
      async () => {
        const assets = await this.getAllAssetsCached();
        const filteredAssets = assets.filter(
          (asset) => asset.dojoWins !== 0 || asset.dojoLosses !== 0,
        );
        this.calculateTotalGames(filteredAssets);
        const sortedAssets = this.sortAssetsByWinsAndLosses(filteredAssets);
        return sortedAssets;
      },
      600,
    );
  }

  async getBonusData(userAsset: IAlgoNFTAsset, userTotalAssets: number): Promise<GameBonusData> {
    return await this.cache.getFromCacheOrFetch(
      DarumaTrainingCacheKeys.BONUS_ASSETS,
      async () => {
        const rankedAssetsSorted = await this.assetRankingByWinsTotalGames();

        const allPlayerAssets = await this.getAllAssetsCached();
        const { averageTotalGames, averageWins } =
          this.getAverageTotalGamesAndWins(allPlayerAssets);
        const averageRank = this.getAverageRank(rankedAssetsSorted);
        const averageTotalAssets = await this.getAverageDarumaOwned();
        // get each unique owner wallet and average out their total assets

        const gameBonusData = {
          averageTotalGames,
          assetTotalGames: 0, // will be set later
          averageWins,
          assetWins: 0, // will be set later
          averageRank,
          assetRank: 0, // will be set later
          averageTotalAssets,
          userTotalAssets,
        };
        // get the asset rank of the user
        gameBonusData.assetRank =
          rankedAssetsSorted.findIndex((asset) => asset._id == userAsset._id) + 1;
        // get the asset total games
        gameBonusData.assetTotalGames = userAsset.dojoWins + userAsset.dojoLosses;
        // get the asset wins
        gameBonusData.assetWins = userAsset.dojoWins;

        gameBonusData.userTotalAssets = userTotalAssets;

        return gameBonusData;
      },
      600,
    );
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

  getAverageTotalGamesAndWins(allPlayerAssets: AlgoNFTAsset[]): {
    averageTotalGames: number;
    averageWins: number;
  } {
    const { totalGames, totalWins } = this.calculateTotalGames(allPlayerAssets);
    let averageTotalGames = 0;
    let averageWins = 0;
    if (allPlayerAssets.length > 0) {
      averageTotalGames = totalGames / allPlayerAssets.length;
      averageWins = totalWins / allPlayerAssets.length;
    }
    return {
      averageTotalGames: Math.round(averageTotalGames),
      averageWins: Math.round(averageWins),
    };
  }
  getAverageRank(rankedAssetsSorted: AlgoNFTAsset[]): number {
    const sumOfRanks = rankedAssetsSorted.reduce(
      (accumulator, _asset, index) => accumulator + index + 1,
      0,
    );
    return Math.round(sumOfRanks / rankedAssetsSorted.length) || 1;
  }
}
