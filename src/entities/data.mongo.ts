import { Document, model, Schema } from 'mongoose';

export interface IData extends Document {
  data: {
    maintenance: boolean;
    lastMaintenance: Date;
    lastStartup: Date;
    karmaBoostModifier: number;
    karmaBoostExpiry: Date;
    karmaBoostStart: Date;
  };
}
// Define the default data
export const defaultData = {
  maintenance: false,
  lastMaintenance: new Date(),
  lastStartup: new Date(),
  karmaBoostModifier: 1,
  karmaBoostExpiry: new Date(),
  karmaBoostStart: new Date(),
};

// Define a type that represents the shape of your data
type DataType = typeof defaultData;

// Define the schema for the single document
const dataSchema = new Schema<IData>(
  {
    data: {
      maintenance: { type: Boolean, default: defaultData.maintenance },
      lastMaintenance: { type: Date, default: defaultData.lastMaintenance },
      lastStartup: { type: Date, default: defaultData.lastStartup },
      karmaBoostModifier: { type: Number, default: defaultData.karmaBoostModifier },
      karmaBoostExpiry: { type: Date, default: defaultData.karmaBoostExpiry },
      karmaBoostStart: { type: Date, default: defaultData.karmaBoostStart },
    },
  },
  { collection: 'dataModel' },
);

// Define the model
export const dataModel = model<IData>('Data', dataSchema);

/*
Functions
*/

// Function to get data
export async function getData<K extends keyof DataType>(key: K): Promise<DataType[K]> {
  let document = await dataModel.findOne();
  if (!document) {
    document = await dataModel.findOneAndUpdate(
      {},
      { data: defaultData },
      { upsert: true, new: true },
    );
  }
  return document?.data[key] ?? defaultData[key];
}

// Function to set data
export async function setData<K extends keyof DataType>(key: K, value: DataType[K]): Promise<void> {
  await dataModel.updateOne({}, { $set: { [`data.${key}`]: value } }, { upsert: true });
}
