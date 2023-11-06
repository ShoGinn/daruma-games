import { Document, model, Schema } from 'mongoose';

export interface IUserAlgoStdAsset {
  id: number;
  optedIn: boolean;
  tokens: number;
  unclaimedTokens: number;
}
export interface IUserAlgoWallets {
  address: string;
  asa: IUserAlgoStdAsset[];
}
export interface IUserAlgoAssets {
  wallets: IUserAlgoWallets[];
}
export interface IUser extends Document {
  _id: string;
  algoAssets: IUserAlgoAssets;
  artifactToken: number;
}

// Define schema for IUserAlgoStdAsset
const userAlgoStdAssetSchema = new Schema<IUserAlgoStdAsset>({
  id: { type: Number, required: true },
  optedIn: { type: Boolean, required: true },
  tokens: { type: Number, required: true },
  unclaimedTokens: { type: Number, required: true, default: 0 },
});

// Define schema for IUserAlgoWallets
const userAlgoWalletsSchema = new Schema<IUserAlgoWallets>({
  address: { type: String, required: true },
  asa: { type: [userAlgoStdAssetSchema], required: true }, // nested schema
});

// Define schema for IUserAlgoAssets
const userAlgoAssetsSchema = new Schema<IUserAlgoAssets>({
  wallets: { type: [userAlgoWalletsSchema], required: true }, // nested schema
});

// Define schema for IUser, extending Document
const userSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    algoAssets: { type: userAlgoAssetsSchema, required: false }, // nested schema
    artifactToken: { type: Number, default: 0 },
  },
  { collection: 'users' },
);

// Create and export the model
export const user = model<IUser>('User', userSchema);
