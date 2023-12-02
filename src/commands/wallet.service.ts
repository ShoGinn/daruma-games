import { ButtonInteraction, CommandInteraction, InteractionReplyOptions } from 'discord.js';

import { inject, injectable } from 'tsyringe';

import { NFDomainsManager } from '../manager/nf-domains.js';
import { AlgoNFTAssetService } from '../services/algo-nft-assets.js';
import { AlgoStdAssetsService } from '../services/algo-std-assets.js';
import { Algorand } from '../services/algorand.js';
import { RewardsService } from '../services/rewards.js';
import { StatsService } from '../services/stats.js';
import { UserService } from '../services/user.js';
import { DiscordId, WalletAddress } from '../types/core.js';

import { buildWalletEmbed, sendWalletEmbeds } from './wallet.embeds.js';

@injectable()
export class WalletCommandService {
  constructor(
    @inject(Algorand) private algoRepo: Algorand,
    @inject(NFDomainsManager) private nfDomainsManager: NFDomainsManager,
    @inject(AlgoNFTAssetService) private algoNFTAssetService: AlgoNFTAssetService,
    @inject(AlgoStdAssetsService) private algoStdAssetService: AlgoStdAssetsService,
    @inject(UserService) private userService: UserService,
    @inject(RewardsService) private rewardsService: RewardsService,
    @inject(StatsService) private statsService: StatsService,
  ) {}
  async clearUserCoolDowns(discordUserId: DiscordId): Promise<InteractionReplyOptions> {
    await this.algoNFTAssetService.clearAssetCoolDownsForUser(discordUserId);
    return { content: 'All cool downs cleared', ephemeral: true };
  }
  async paginatedWalletEmbeds(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
    const discordUserId = interaction.user.id as DiscordId;
    const wallets = (await this.userService.getUserWallets(discordUserId)) ?? [];
    const walletEmbeds = await this.buildWalletData(interaction, wallets);
    await sendWalletEmbeds(interaction, walletEmbeds);
  }
  async buildWalletData(
    interaction: CommandInteraction | ButtonInteraction,
    wallets: WalletAddress[],
  ): Promise<InteractionReplyOptions[]> {
    const stdAssets = await this.algoStdAssetService.getAllStdAssets();

    const walletEmbeds: InteractionReplyOptions[] = [];
    for (const wallet of wallets) {
      const walletAssetCount = await this.statsService.getTotalAssetsByWallet(wallet);
      const walletTokens = await this.rewardsService.getAllRewardTokensByWallet(wallet);
      const nfDomain = await this.nfDomainsManager.getWalletDomainNamesFromWallet(wallet);
      const randomThumbnail = await this.algoNFTAssetService.getRandomImageURLByWallet(wallet);

      const embed = await buildWalletEmbed(
        interaction,
        this.algoRepo,
        wallet,
        wallets.length,
        walletAssetCount,
        walletTokens,
        stdAssets,
        nfDomain,
        randomThumbnail,
      );
      walletEmbeds.push(embed);
    }
    return walletEmbeds;
  }
  async removeWallet(interaction: ButtonInteraction): Promise<InteractionReplyOptions> {
    const discordUserId = interaction.user.id as DiscordId;
    const address = interaction.customId.split('_')[1] as WalletAddress;
    if (!address) {
      throw new Error('No address found');
    }
    const response = await this.userService.removeWalletFromUser(address, discordUserId);
    const message = response.modifiedCount === 1 ? 'Wallet Removed' : 'Wallet not found';
    return { content: message, ephemeral: true };
  }
}
