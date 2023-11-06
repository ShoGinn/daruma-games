import { Document, model, Schema } from 'mongoose';

export interface IAlgoStdAsset extends Document {
  _id: number;
  name: string;
  unitName: string;
  url: string;
  decimals: number;
}

const algoStdAssetSchema = new Schema<IAlgoStdAsset>(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true },
    unitName: { type: String, required: true },
    url: { type: String, required: true },
    decimals: { type: Number, required: true },
  },
  {
    collection: 'algoStdAsset',
  },
);
export const algoStdAsset = model<IAlgoStdAsset>('algoStdAsset', algoStdAssetSchema);
