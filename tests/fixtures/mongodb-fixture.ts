/* eslint-disable @typescript-eslint/no-explicit-any */
import { isArray } from 'lodash';
import mongoose from 'mongoose';

export async function setupMongo(databaseName?: string): Promise<void> {
  let mongoUriArgument = 'mongodb://127.0.0.1:27017/';
  mongoUriArgument += databaseName ?? 'test';

  const mongoUri = process.env['MONGODB_URI'] || mongoUriArgument;
  await mongoose.connect(mongoUri);
}
export async function tearDownMongo(
  model?: mongoose.Model<any> | Array<mongoose.Model<any>>,
): Promise<void> {
  if (!isArray(model) && model) {
    await mongoose.connection.dropCollection(model.collection.collectionName);
  }
  if (isArray(model)) {
    for (const m of model) {
      await mongoose.connection.dropCollection(m.collection.collectionName);
    }
  }
  await mongoose.disconnect();
}

export function mongoFixture<T>(model: mongoose.Model<T>): void {
  beforeAll(async () => {
    await setupMongo();
  });

  beforeEach(async () => {
    await model.deleteMany({});
  });
  afterAll(async () => {
    await tearDownMongo(model);
  });
}
