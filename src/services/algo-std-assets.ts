import { inject, injectable, singleton } from 'tsyringe';

import { AlgoStdAssetsRepository } from '../database/algo-std-asset/algo-std-asset.repo.js';
import { AlgoStdAsset } from '../database/algo-std-asset/algo-std-asset.schema.js';
import { LookUpAssetByIDResponse } from '../types/algorand.js';

import { stdAssetTemplate } from './algo-std-assets.formatter.js';
import { Algorand } from './algorand.js';

@singleton()
@injectable()
export class AlgoStdAssetsService {
  constructor(
    @inject(Algorand) private algorandRepo: Algorand,
    @inject(AlgoStdAssetsRepository) private algoStdAssetRepo: AlgoStdAssetsRepository,
  ) {}
  setDecimalsForAlgoStdAsset(stdAsset: LookUpAssetByIDResponse): number {
    if (stdAsset.asset.params.decimals === 0) {
      return 0;
    }

    if (stdAsset.asset.params.decimals > 0 && stdAsset.asset.params.decimals <= 19) {
      return stdAsset.asset.params.decimals;
    } else {
      throw new Error('Invalid decimals value for asset must be between 0 and 19');
    }
  }

  async createAlgoStdAssetFromLookupResult(
    stdAsset: LookUpAssetByIDResponse,
  ): Promise<AlgoStdAsset> {
    const decimals = this.setDecimalsForAlgoStdAsset(stdAsset);
    return await this.algoStdAssetRepo.createStdAsset({
      _id: stdAsset.asset.index,
      name: stdAsset.asset.params.name ?? ' ',
      unitName: stdAsset.asset.params['unit-name'] ?? ' ',
      url: stdAsset.asset.params.url ?? ' ',
      decimals,
    });
  }

  async addAlgoStdAsset(assetIndex: number): Promise<AlgoStdAsset> {
    if (await this.algoStdAssetRepo.doesAssetExist(assetIndex)) {
      throw new Error(stdAssetTemplate.AssetIndexExists({ assetIndex }));
    }
    const stdAsset = await this.algorandRepo.lookupAssetByIndex(assetIndex);

    await this.checkForAssetWithSameUnitName(stdAsset);

    return await this.createAlgoStdAssetFromLookupResult(stdAsset);
  }

  async checkForAssetWithSameUnitName(stdAsset: LookUpAssetByIDResponse): Promise<void> {
    const stdAssetUnitName = stdAsset.asset.params['unit-name'];
    if (!stdAssetUnitName) {
      return;
    }
    const assetWithSameUnitName =
      await this.algoStdAssetRepo.getStdAssetByUnitName(stdAssetUnitName);
    if (assetWithSameUnitName) {
      throw new Error(stdAssetTemplate.AssetUnitNameExists({ unitName: stdAssetUnitName }));
    }
  }

  async deleteStdAsset(assetIndex: number): Promise<void> {
    const asset = await this.algoStdAssetRepo.deleteStdAsset(assetIndex);
    if (!asset) {
      throw new Error(stdAssetTemplate.AssetIndexNotFound({ assetIndex }));
    }
  }

  async getAllStdAssets(): Promise<AlgoStdAsset[]> {
    return await this.algoStdAssetRepo.getAllStdAssets();
  }
  async getStdAssetByAssetIndex(assetIndex: number): Promise<AlgoStdAsset> {
    const foundAsset = await this.algoStdAssetRepo.getStdAssetByAssetIndex(assetIndex);
    if (!foundAsset) {
      throw new Error(stdAssetTemplate.AssetIndexNotFound({ assetIndex }));
    }
    return foundAsset;
  }
  async getStdAssetByUnitName(unitName: string): Promise<AlgoStdAsset> {
    const foundAsset = await this.algoStdAssetRepo.getStdAssetByUnitName(unitName);
    if (!foundAsset) {
      throw new Error(stdAssetTemplate.AssetUnitNameNotFound({ unitName }));
    }
    return foundAsset;
  }
}
