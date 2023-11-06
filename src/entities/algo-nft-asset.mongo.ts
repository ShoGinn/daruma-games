import { HydratedDocument, model, Schema } from 'mongoose';

import { Arc69Payload } from '../model/types/algorand.js';

export interface IRequiredAlgoNFTAsset {
  _id: number;
  creator: string;
  name: string;
  unitName: string;
  url: string;
}

export interface IOptionalAlgoNFTAsset {
  alias?: string;
  battleCry?: string;
  wallet?: string;
  arc69?: Arc69Payload;
  dojoCoolDown?: Date;
  dojoWins?: number;
  dojoLosses?: number;
  dojoZen?: number;
}

// Combined interface extending Document
export interface IAlgoNFTAsset extends IRequiredAlgoNFTAsset, IOptionalAlgoNFTAsset {}

const algoNFTAssetSchema = new Schema<IAlgoNFTAsset>(
  {
    _id: { type: Number, required: true },
    creator: { type: String, required: true },
    name: { type: String, required: true },
    unitName: { type: String, required: true },
    url: { type: String, required: true },
    alias: String,
    battleCry: String,
    wallet: String,
    arc69: Schema.Types.Mixed,
    dojoCoolDown: { type: Date, default: Date.now },
    dojoWins: { type: Number, default: 0 },
    dojoLosses: { type: Number, default: 0 },
    dojoZen: { type: Number, default: 0 },
  },
  {
    collection: 'algoNFTAsset',
  },
);

export const algoNFTAsset = model<IAlgoNFTAsset>('algoNFTAsset', algoNFTAssetSchema);

/*
Functions for manipulating data
*/

export async function addNFTAsset(asset: IAlgoNFTAsset): Promise<IAlgoNFTAsset> {
  const newAsset: HydratedDocument<IAlgoNFTAsset> = new algoNFTAsset(asset);
  return await newAsset.save();
}

export async function addOrUpdateManyNFTAssets(assets: IAlgoNFTAsset[]): Promise<void> {
  const bulkOps = assets.map((asset) => ({
    updateOne: {
      filter: { _id: asset._id },
      update: asset,
      upsert: true,
    },
  }));
  await algoNFTAsset.bulkWrite(bulkOps);
}
// export async function creatorAssetSync(): Promise<void> {
//   const em = container.resolve(MikroORM).em.fork();
//   const creatorAddressArray = await em.getRepository(AlgoWallet).getCreatorWallets();
//   const algorand = container.resolve(Algorand);
//   for (const creator of creatorAddressArray) {
//     const creatorAssets = await algorand.getCreatedAssets(creator.address);
//     await this.addAssetsLookup(creator, creatorAssets);
//   }

//   const assetsWithUpdatedMetadata = await algorand.getBulkAssetArc69Metadata(
//     await this.getAllRealWorldAssetIndexesWithoutArc69(),
//   );
//   await this.persistBulkArc69(assetsWithUpdatedMetadata);
// }

// export function async function addAssetsLookup(
//   creatorWallet: AlgoWallet,
//   creatorAssets: IndexerAssetResult[] | MainAssetResult[],
// ): Promise<void> {
//   const existingAssets = await this.getAllRealWorldAssets();
//   // Filter out assets that already exist
//   const filteredAssets = creatorAssets.filter(
//     (asset) => !existingAssets.some((existingAsset) => existingAsset.id === asset.index),
//   );
//   const newAssets = filteredAssets.map((nonExistingAsset) => {
//     const assetId = nonExistingAsset?.index;
//     const { url, name, 'unit-name': unitName } = nonExistingAsset.params;
//     return new AlgoNFTAsset(assetId, creatorWallet, name ?? ' ', unitName ?? ' ', url ?? ' ');
//   });
//   const em = this.getEntityManager();
//   await em.persistAndFlush(newAssets);
// }
