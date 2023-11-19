import mongoose from 'mongoose';

export async function setupMongo(): Promise<void> {
  const mongoUri = process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017/test';
  await mongoose.connect(mongoUri);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tearDownMongo(model: mongoose.Model<any>): Promise<void> {
  await mongoose.connection.dropCollection(model.collection.name);
  await mongoose.disconnect();
}
