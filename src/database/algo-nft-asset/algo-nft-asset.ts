import { model } from 'mongoose';

import { algoNFTAssetSchema, IAlgoNFTAsset } from './algo-nft-asset.schema.js';

export const algoNFTAssetModel = model<IAlgoNFTAsset>('algoNFTAsset', algoNFTAssetSchema);
