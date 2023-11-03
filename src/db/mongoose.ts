import mongoose from 'mongoose';

import { getConfig } from '../config/config.js';
import logger from '../utils/functions/logger-factory.js';

export async function mongooseConnect(): Promise<void> {
  const botConfig = getConfig();
  const mongoUri = botConfig.get('mongodbUri');
  // Remove the password from the URI for logging purposes
  const MONGO_URL = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//');
  mongoose.connection.on('connected', () => {
    if (botConfig.get('nodeEnv') !== 'test') {
      logger.info(`Connected to the database: ${MONGO_URL}`);
    }
  });
  mongoose.connection.on('disconnected', () => {
    logger.info(`Disconnected from the database: ${MONGO_URL}`);
  });
  mongoose.connection.on('error', (error) => {
    logger.error(`Database connection error: ${MONGO_URL} ${error}`);
  });
  await mongoose.connect(mongoUri);
}
