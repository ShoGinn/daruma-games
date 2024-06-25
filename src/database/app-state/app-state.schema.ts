import { HydratedDocument, Schema } from 'mongoose';

export interface IAppState {
  maintenance: boolean;
  lastMaintenance: Date;
  creatorAssetSync: Date;
  karmaBoostModifier: number;
  karmaBoostExpiry: Date;
  karmaBoostStart: Date;
}
// Define the default data
export const defaultAppStates = {
  maintenance: false,
  lastMaintenance: new Date(),
  creatorAssetSync: new Date(),
  karmaBoostModifier: 1,
  karmaBoostExpiry: new Date(),
  karmaBoostStart: new Date(),
};

// Define a type that represents the shape of your data
export type AppState = typeof defaultAppStates;

// Define the schema for the single document
export const appStateSchema = new Schema<IAppState>(
  {
    maintenance: { type: Boolean, default: defaultAppStates.maintenance },
    lastMaintenance: { type: Date, default: defaultAppStates.lastMaintenance },
    creatorAssetSync: { type: Date, default: defaultAppStates.creatorAssetSync },
    karmaBoostModifier: { type: Number, default: defaultAppStates.karmaBoostModifier },
    karmaBoostExpiry: { type: Date, default: defaultAppStates.karmaBoostExpiry },
    karmaBoostStart: { type: Date, default: defaultAppStates.karmaBoostStart },
  },
  { collection: 'appState' },
);

export type DataDocument = HydratedDocument<IAppState>;
