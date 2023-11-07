import { AlgoStdToken } from '../entities/algo-std-token.entity.js';
import { AlgoWallet } from '../entities/algo-wallet.entity.js';
import { User } from '../entities/user.entity.js';
import { UnclaimedAsset, WalletWithUnclaimedAssets } from '../model/types/algorand.js';
import logger from '../utils/functions/logger-factory.js';

import { AbstractDatabaseRepository } from './abstract-database-repository.js';

export class AlgorandRepository extends AbstractDatabaseRepository {
  async removeUnclaimedTokensFromMultipleWallets(
    chunk: WalletWithUnclaimedAssets[],
    asset: UnclaimedAsset,
  ): Promise<void> {
    const em = this.orm.em.fork();

    const algoStdToken = em.getRepository(AlgoStdToken);
    const userDatabase = em.getRepository(User);
    const walletDatabase = em.getRepository(AlgoWallet);

    for (const wallet of chunk) {
      const userWallet = await walletDatabase.findOneOrFail({ address: wallet.walletAddress });
      await algoStdToken.removeUnclaimedTokens(userWallet, asset.id, wallet.unclaimedTokens);
      await userDatabase.syncUserWallets(wallet.userId);
    }
  }

  async fetchWalletsWithUnclaimedAssets(
    claimThreshold: number,
    asset: UnclaimedAsset,
  ): Promise<WalletWithUnclaimedAssets[]> {
    const em = this.orm.em.fork();
    const userDatabase = em.getRepository(User);
    const algoWalletDatabase = em.getRepository(AlgoWallet);
    const algoStdToken = em.getRepository(AlgoStdToken);
    await userDatabase.userAssetSync();
    const users = await userDatabase.getAllUsers();
    // Get all users wallets that have opted in and have unclaimed "Asset Tokens"
    const walletsWithUnclaimedAssets: WalletWithUnclaimedAssets[] = [];
    for (const user of users) {
      const { optedInWallets } = await algoWalletDatabase.allWalletsOptedIn(
        user.id,
        asset.unitName,
      );
      // If no opted in wallets, goto next user
      if (!optedInWallets || optedInWallets.length === 0) {
        continue;
      }
      for (const wallet of optedInWallets) {
        const singleWallet = await algoStdToken.getWalletWithUnclaimedTokens(wallet, asset.id);
        if (singleWallet && singleWallet?.unclaimedTokens > claimThreshold) {
          walletsWithUnclaimedAssets.push({
            walletAddress: wallet.address,
            unclaimedTokens: singleWallet.unclaimedTokens,
            userId: user.id,
          });
        }
      }
    }
    if (walletsWithUnclaimedAssets.length === 0) {
      logger.info(`No unclaimed ${asset.name} to claim`);
    }
    return walletsWithUnclaimedAssets;
  }
}
