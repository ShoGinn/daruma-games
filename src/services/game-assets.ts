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
  public karmaAsset?: AlgoStdAsset;
  public enlightenmentAsset?: AlgoStdAsset;
  private initializedAssets = new Set<string>();

  public isReady(): boolean {
    return this.initializedAssets.size === 2;
  }

  private async initializeAsset(assetName: string, targetProperty: AssetTarget): Promise<boolean> {
    try {
      this[targetProperty] = await this.algoStdAssetService.getStdAssetByUnitName(assetName);
      this.initializedAssets.add(targetProperty);
    } catch {
      logger.error(`Failed to get the necessary assets (${assetName}) from the database`);
      return false;
    }

    return true;
  }
  public async initializeKRMA(): Promise<boolean> {
    return await this.initializeAsset('KRMA', 'karmaAsset');
  }

  public async initializeENLT(): Promise<boolean> {
    return await this.initializeAsset('ENLT', 'enlightenmentAsset');
  }

  @PostConstruct
  public initializeAll(): Promise<[boolean, boolean]> {
    return Promise.all([this.initializeKRMA(), this.initializeENLT()]);
  }
}
