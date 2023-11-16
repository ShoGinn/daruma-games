import { HydratedDocument, Schema } from 'mongoose';

import { Arc69Payload } from '../../types/algorand.js';
import { WalletAddress } from '../../types/core.js';

export interface IAlgoNFTAsset {
  _id: number;
  creator: WalletAddress;
  name: string;
  unitName: string;
  url: string;
  alias?: string;
  battleCry?: string;
  wallet?: WalletAddress;
  arc69?: Arc69Payload;
  dojoCoolDown: Date;
  dojoWins: number;
  dojoLosses: number;
  dojoZen: number;
}

export const algoNFTAssetSchema = new Schema<IAlgoNFTAsset>(
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

export type AlgoNFTAsset = HydratedDocument<IAlgoNFTAsset>;
