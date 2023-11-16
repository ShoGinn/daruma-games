import { model } from 'mongoose';

import { algoStdAssetSchema, IAlgoStdAsset } from './algo-std-asset.schema.js';

export const algoStdAssetModel = model<IAlgoStdAsset>('algoStdAsset', algoStdAssetSchema);
