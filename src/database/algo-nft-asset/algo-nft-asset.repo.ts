import { mongo, UpdateWriteOpResult } from 'mongoose';
import { singleton } from 'tsyringe';

import { Arc69MetaData } from '../../types/algorand.js';
import { WalletAddress } from '../../types/core.js';

import { algoNFTAssetModel } from './algo-nft-asset.js';
import { AlgoNFTAsset, IAlgoNFTAsset } from './algo-nft-asset.schema.js';

@singleton()
export class AlgoNFTAssetRepository {
  async createAsset(asset: AlgoNFTAsset): Promise<AlgoNFTAsset> {
    return await algoNFTAssetModel.create(asset);
  }
  async removeAssetsByCreator(walletAddress: WalletAddress): Promise<mongo.DeleteResult> {
    return await algoNFTAssetModel.deleteMany({ creator: walletAddress }).exec();
  }

  async getAssetById(assetId: number): Promise<AlgoNFTAsset | null> {
    return await algoNFTAssetModel.findById(assetId).exec();
  }
  async getAssetsByWallets(walletAddresses: WalletAddress[]): Promise<AlgoNFTAsset[] | []> {
    return await algoNFTAssetModel.find({ wallet: { $in: walletAddresses } }).exec();
  }
  async getAllAssets(): Promise<AlgoNFTAsset[] | []> {
    return await algoNFTAssetModel.find().exec();
  }

  async getAssetsWithoutArc69(): Promise<AlgoNFTAsset[] | []> {
    return await algoNFTAssetModel
      .find({
        arc69: { $eq: null },
      })
      .exec();
  }
  async updateAssetDojoStats(
    assetId: number,
    coolDown: number,
    wins: number = 0,
    losses: number = 0,
    zen: number = 0,
  ): Promise<AlgoNFTAsset | null> {
    return await algoNFTAssetModel
      .findOneAndUpdate(
        { _id: assetId }, // filter
        {
          $inc: {
            dojoWins: wins,
            dojoLosses: losses,
            dojoZen: zen,
          },
          dojoCoolDown: new Date(coolDown + Date.now()),
        }, // update
        { new: true }, // options
      )
      .exec();
  }

  async addOrUpdateManyAssets(
    assets: AlgoNFTAsset[] | IAlgoNFTAsset[],
  ): Promise<mongo.BulkWriteResult> {
    const bulkOps = assets.map((asset) => {
      const update = 'toObject' in asset ? asset.toObject() : asset;
      return {
        updateOne: {
          filter: { _id: asset._id },
          update,
          upsert: true,
        },
      };
    });
    return await algoNFTAssetModel.bulkWrite(bulkOps);
  }
  async updateArc69ForMultipleAssets(assets: Arc69MetaData[] | []): Promise<mongo.BulkWriteResult> {
    const bulkOps = assets.map((asset) => ({
      updateOne: {
        filter: { _id: asset.id },
        update: { $set: { arc69: asset.arc69 } },
      },
    }));

    return await algoNFTAssetModel.bulkWrite(bulkOps);
  }

  async clearAllAssetsCoolDowns(): Promise<UpdateWriteOpResult> {
    return await algoNFTAssetModel.updateMany({}, { dojoCoolDown: new Date(0) }).exec();
  }

  async clearAssetsCoolDownsByWallets(
    walletAddresses: WalletAddress[],
  ): Promise<UpdateWriteOpResult> {
    // clear cool downs for each wallet
    return await algoNFTAssetModel
      .updateMany({ wallet: { $in: walletAddresses } }, { dojoCoolDown: new Date(0) })
      .exec();
  }
  async clearAssetsCoolDownsByIds(assetIds: number[]): Promise<UpdateWriteOpResult> {
    return await algoNFTAssetModel
      .updateMany({ _id: { $in: assetIds } }, { dojoCoolDown: new Date(0) })
      .exec();
  }
  async getAssetCountByWallets(wallets: WalletAddress[]): Promise<number> {
    return await algoNFTAssetModel
      .countDocuments({
        wallet: { $in: wallets },
      })
      .exec();
  }

  async getRandomAssetsSampleByWallets(
    walletAddresses: WalletAddress[],
    numberOfAssets: number,
  ): Promise<AlgoNFTAsset[] | []> {
    // Get a random sample of assets from all wallets
    return await algoNFTAssetModel.aggregate([
      { $match: { wallet: { $in: walletAddresses } } },
      { $sample: { size: numberOfAssets } },
    ]);
  }
}
