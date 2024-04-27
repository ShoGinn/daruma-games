/* eslint-disable @typescript-eslint/no-explicit-any */
import { isArray } from 'lodash';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

export async function setupMongo(databaseName?: string): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  if (databaseName) {
    await mongoose.connect(`${mongoUri}/${databaseName}`);
    return;
  }
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
  try {
    await mongoServer.stop();
  } catch {
    // Do nothing
  }
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
