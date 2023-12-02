import { HydratedDocument, Schema } from 'mongoose';

import { DiscordId, WalletAddress } from '../../types/core.js';

interface IUserAlgoWallets {
  address: WalletAddress;
}
export interface IUser {
  _id: DiscordId;
  algoWallets?: IUserAlgoWallets[];
  artifactToken: number;
}

// Define schema for IUserAlgoWallets
const userAlgoWalletsSchema = new Schema<IUserAlgoWallets>(
  {
    address: { type: String, required: true, unique: true },
  },
  {
    _id: false,
  },
);

// Define schema for IUser, extending Document
export const userSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    algoWallets: { type: [userAlgoWalletsSchema], required: false }, // nested schema
    artifactToken: { type: Number, default: 0 },
  },
  { collection: 'users' },
);

export type DatabaseUser = HydratedDocument<IUser>;
