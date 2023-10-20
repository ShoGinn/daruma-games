import { MikroORM } from '@mikro-orm/core';
import { injectable, singleton } from 'tsyringe';

import { AlgoStdAsset } from '../../entities/algo-std-asset.entity.js';
import logger from '../../utils/functions/logger-factory.js';
import { PostConstruct } from '../framework/decorators/post-construct.js';

type AssetTarget = 'karmaAsset' | 'enlightenmentAsset';

@singleton()
@injectable()
export class GameAssets {
  public karmaAsset?: AlgoStdAsset;
  public enlightenmentAsset?: AlgoStdAsset;
  private initializedAssets = new Set<string>();

  constructor(private orm: MikroORM) {}

  public isReady(): boolean {
    return this.initializedAssets.size === 2;
  }

  private async initializeAsset(assetName: string, targetProperty: AssetTarget): Promise<boolean> {
    const em = this.orm.em.fork();
    const algoStdAssetRepository = em.getRepository(AlgoStdAsset);

    try {
      this[targetProperty] = await algoStdAssetRepository.getStdAssetByUnitName(assetName);
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
