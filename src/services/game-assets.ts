import { inject, injectable, singleton } from 'tsyringe';

import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { PostConstruct } from '../decorators/post-construct.js';
import logger from '../utils/functions/logger-factory.js';

import { AlgoStdAssetsService } from './algo-std-assets.js';

type AssetTarget = 'karmaAsset' | 'enlightenmentAsset';

@singleton()
@injectable()
export class GameAssets {
  constructor(@inject(AlgoStdAssetsService) private algoStdAssetService: AlgoStdAssetsService) {}

  private initializedAssets = new Map<AssetTarget, AlgoStdAsset>();

  public get karmaAsset(): AlgoStdAsset {
    const asset = this.initializedAssets.get('karmaAsset');
    if (!asset) {
      throw new Error('Karma asset has not been initialized yet!');
    }
    return asset;
  }

  public get enlightenmentAsset(): AlgoStdAsset {
    const asset = this.initializedAssets.get('enlightenmentAsset');
    if (!asset) {
      throw new Error('Enlightenment asset has not been initialized yet!');
    }
    return asset;
  }

  public isReady(): boolean {
    return this.initializedAssets.size === 2;
  }

  private async initializeAsset(assetName: string, targetProperty: AssetTarget): Promise<boolean> {
    try {
      const asset = await this.algoStdAssetService.getStdAssetByUnitName(assetName);
      this.initializedAssets.set(targetProperty, asset);
    } catch {
      logger.error(`Failed to get the necessary assets (${assetName}) from the database`);
      return false;
    }

    return true;
  }

  @PostConstruct
  public initializeAll(): Promise<[boolean, boolean]> {
    return Promise.all([
      this.initializeAsset('KRMA', 'karmaAsset'),
      this.initializeAsset('ENLT', 'enlightenmentAsset'),
    ]);
  }
}
