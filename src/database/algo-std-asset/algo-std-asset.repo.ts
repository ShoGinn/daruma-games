import { singleton } from 'tsyringe';

import { algoStdAssetModel } from './algo-std-asset.js';
import { AlgoStdAsset, IAlgoStdAsset } from './algo-std-asset.schema.js';

@singleton()
export class AlgoStdAssetsRepository {
  async doesAssetExist(assetIndex: number): Promise<boolean> {
    return !!(await algoStdAssetModel.findById(assetIndex).exec());
  }

  async createStdAsset(stdAsset: IAlgoStdAsset): Promise<AlgoStdAsset> {
    return await algoStdAssetModel.create({ ...stdAsset });
  }

  async deleteStdAsset(assetIndex: number): Promise<boolean> {
    const asset = await algoStdAssetModel.deleteOne({ _id: assetIndex }).exec();
    return asset.deletedCount > 0;
  }

  async getAllStdAssets(): Promise<AlgoStdAsset[] | []> {
    return await algoStdAssetModel.find().exec();
  }
  async getStdAssetByAssetIndex(assetIndex: number): Promise<AlgoStdAsset | null> {
    return await algoStdAssetModel.findById(assetIndex).exec();
  }
  async getStdAssetByUnitName(unitName: string): Promise<AlgoStdAsset | null> {
    return await algoStdAssetModel.findOne({ unitName }).exec();
  }
}
