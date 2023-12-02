import convict from 'convict';
import { url } from 'convict-format-with-validator';
import dotenv from 'dotenv';
import { Memoizer } from 'memoizer-ts';

import logger from '../utils/functions/logger-factory.js';

import {
  mnemonicFormat,
  nonEmptyString,
  validAlgoAddressFormat,
  webhookUrlValidator,
} from './validators.js';

/* istanbul ignore next */
if (!process.env['JEST_WORKER_ID']) {
  dotenv.config();
}
convict.addFormats({
  url,
  nonEmptyString,
  webhookUrlValidator,
  mnemonicFormat,
  validAlgoAddressFormat,
});
interface IConfigSchema {
  nodeEnv: string;
  discordToken: string;
  botOwnerID: string;
  adminChannelId: string;
  mongodbUri: string;
  replenishTokenAddress?: string;
  transactionWebhook?: string;
  ipfsGateway: string;
  tenorApiKey?: string;
  gameAssets: {
    karma: string;
    enlightenment: string;
  };
}
const configSchema = convict<IConfigSchema>({
  nodeEnv: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  discordToken: {
    format: 'nonEmptyString',
    default: '',
    sensitive: true,
    env: 'BOT_TOKEN',
  },
  botOwnerID: {
    format: 'nonEmptyString',
    default: '',
    env: 'BOT_OWNER_ID',
  },
  adminChannelId: {
    format: 'nonEmptyString',
    default: '',
    env: 'ADMIN_CHANNEL_ID',
  },
  mongodbUri: {
    doc: 'The URI for the MongoDB database.',
    format: 'nonEmptyString',
    default: 'mongodb://localhost:27017/test',
    sensitive: true,
    env: 'MONGODB_URI',
  },
  replenishTokenAddress: {
    doc: 'The address of the account that will be used to replenish tokens.',
    format: 'validAlgoAddressFormat',
    default: null,
    nullable: true,
    env: 'REPLENISH_TOKEN_ADDRESS',
  },
  transactionWebhook: {
    doc: 'The URL for the transaction webhook.',
    format: 'webhookUrlValidator',
    default: '',
    nullable: true,
    sensitive: true,
    env: 'TRANSACTION_WEBHOOK',
  },
  ipfsGateway: {
    doc: 'The URL for the IPFS gateway.',
    format: 'url',
    default: 'https://ipfs.algonode.xyz/ipfs/',
    env: 'IPFS_GATEWAY',
  },
  tenorApiKey: {
    doc: 'The API key for Tenor.',
    format: 'nonEmptyString',
    default: null,
    nullable: true,
    sensitive: true,
    env: 'TENOR_API_KEY',
  },
  gameAssets: {
    karma: {
      doc: 'The Algorand Unit Name for the karma asset.',
      format: 'nonEmptyString',
      default: 'KRMA',
      env: 'KARMA_ASSET',
    },
    enlightenment: {
      doc: 'The Algorand Unit Name for the enlightenment asset.',
      format: 'nonEmptyString',
      default: 'ENLT',
      env: 'ENLIGHTENMENT_ASSET',
    },
  },
});
function logConfig(): void {
  logger.verbose(`Resolved Configuration:\n${configSchema.toString()}`);
}
/* istanbul ignore next */
function validateConfig(): void {
  if (configSchema.get('nodeEnv') !== 'test') {
    configSchema.validate({ allowed: 'strict' });
    logger.verbose('Configuration is valid.');
  }
}
function loadConfiguration(): convict.Config<IConfigSchema> {
  validateConfig();
  logConfig();
  return configSchema;
}

const getConfigInternal = Memoizer.makeMemoized(loadConfiguration);

export function getConfig(internal: boolean = true): convict.Config<IConfigSchema> {
  if (internal) {
    return getConfigInternal();
  }
  return loadConfiguration();
}
