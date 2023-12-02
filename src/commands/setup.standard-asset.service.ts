import { ButtonInteraction, InteractionReplyOptions, ModalSubmitInteraction } from 'discord.js';

import { inject, injectable } from 'tsyringe';

import { AlgoStdAssetsService } from '../services/algo-std-assets.js';
import { GameAssets } from '../services/game-assets.js';

import { paginatedStdAssetWallets } from './setup.standard-asset.embeds.js';

@injectable()
export class SetupStandardAssetCommandService {
  constructor(
    @inject(AlgoStdAssetsService) private stdAssetsService: AlgoStdAssetsService,
    @inject(GameAssets) private gameAssets: GameAssets,
  ) {}
  async stdAssetWallets(interaction: ButtonInteraction): Promise<void> {
    const allStdAssets = await this.stdAssetsService.getAllStdAssets();
    await paginatedStdAssetWallets(interaction, allStdAssets);
  }
  async addStdAsset(interaction: ModalSubmitInteraction): Promise<InteractionReplyOptions> {
    const newAsset = Number(interaction.fields.getTextInputValue('new-asset'));

    let message = '';
    try {
      const asset = await this.stdAssetsService.addAlgoStdAsset(newAsset);
      message = asset
        ? `Standard Asset with ID: ${newAsset} Name/Unit-Name: ${asset.name}/${asset.unitName} added to the database`
        : `Standard Asset with ID: ${newAsset} already exists in the database`;
    } catch (error) {
      if (error instanceof Error) {
        message = error.message;
      }
    }
    if (!this.gameAssets.isReady()) {
      await this.gameAssets.initializeAll();
    }
    return { content: message };
  }
  async removeStdAsset(interaction: ButtonInteraction): Promise<InteractionReplyOptions> {
    const address = interaction.customId.split('_')[1];
    try {
      await this.stdAssetsService.deleteStdAsset(Number(address));
      return { content: `ASA's deleted for Wallet Address: ${address}` };
    } catch (error) {
      return error instanceof Error ? { content: error.message } : { content: 'Unknown Error' };
    }
  }
}
