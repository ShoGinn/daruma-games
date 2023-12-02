import { HydratedDocument, Schema } from 'mongoose';

export interface IAlgoStdAsset {
  _id: number;
  name: string;
  unitName: string;
  url: string;
  decimals: number;
}

export const algoStdAssetSchema = new Schema<IAlgoStdAsset>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true },
    unitName: { type: String, required: true },
    url: { type: String, required: true },
    decimals: { type: Number, default: 0 },
  },
  {
    collection: 'algoStdAsset',
  },
);

export type AlgoStdAsset = HydratedDocument<IAlgoStdAsset>;
