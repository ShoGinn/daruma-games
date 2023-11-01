import convict from 'convict';
import { url } from 'convict-format-with-validator';
import dotenv from 'dotenv';
import { Memoizer } from 'memoizer-ts';

import {
  mnemonicFormat,
  nonEmptyString,
  validAlgoAddressFormat,
  webhookUrlValidator,
} from './validators.js';
import logger from '../utils/functions/logger-factory.js';

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
  sqlitePath: string;
  clawbackTokenMnemonic: string;
  claimTokenMnemonic?: string;
  replenishTokenAccount?: string;
  transactionWebhook?: string;
  ipfsGateway: string;
  tenorApiKey?: string;
  algoEngineConfig: {
    algoApiToken?: string;
    algod: {
      server: string;
      port?: number;
    };
    indexer: {
      server: string;
      port?: number;
    };
    apiLimits: {
      points: number;
      duration: number;
    };
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
    default: '',
    sensitive: true,
    env: 'MONGODB_URI',
  },
  sqlitePath: {
    doc: 'The path to the SQLite database file.',
    format: String,
    default: '/data/database.sqlite3',
    env: 'SQLITE_DB_PATH',
  },
  clawbackTokenMnemonic: {
    doc: 'The mnemonic for the clawback token.',
    format: 'mnemonicFormat',
    default: '',
    sensitive: true,
    env: 'CLAWBACK_TOKEN_MNEMONIC',
  },
  claimTokenMnemonic: {
    doc: 'The mnemonic for the claim token.',
    format: 'mnemonicFormat',
    default: null,
    sensitive: true,
    nullable: true,
    env: 'CLAIM_TOKEN_MNEMONIC',
  },
  replenishTokenAccount: {
    doc: 'The address of the account that will be used to replenish tokens.',
    format: 'validAlgoAddressFormat',
    default: null,
    nullable: true,
    env: 'REPLENISH_TOKEN_ACCOUNT',
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
  algoEngineConfig: {
    algoApiToken: {
      doc: 'The Algo API token',
      format: 'nonEmptyString',
      default: null,
      sensitive: true,
      nullable: true,
      env: 'ALGO_API_TOKEN',
    },
    algod: {
      server: {
        doc: 'The Algod server URL',
        format: 'url',
        default: 'https://mainnet-api.algonode.cloud/',
        env: 'ALGOD_SERVER',
      },
      port: {
        doc: 'The Algod server port',
        format: 'port',
        default: null,
        nullable: true,
        env: 'ALGOD_PORT',
      },
    },
    indexer: {
      server: {
        doc: 'The Indexer server URL',
        format: 'url',
        default: 'https://mainnet-idx.algonode.cloud/',
        env: 'INDEXER_SERVER',
      },
      port: {
        doc: 'The Indexer server port',
        format: 'port',
        default: null,
        nullable: true,
        env: 'INDEXER_PORT',
      },
    },
    apiLimits: {
      points: {
        doc: 'The API limits points',
        format: 'nat',
        default: 1,
        env: 'API_LIMITS_POINTS',
      },
      duration: {
        doc: 'The API limits duration',
        format: 'nat',
        default: 1,
        env: 'API_LIMITS_DURATION',
      },
    },
  },
});
export function setupApiLimiters(): void {
  // Check if the algod server is default (algonode), and if so set the api points to 30
  if (
    configSchema.get('algoEngineConfig.algod.server') ==
    configSchema.default('algoEngineConfig.algod.server')
  ) {
    configSchema.set('algoEngineConfig.apiLimits.points', 30);
  } else {
    configSchema.set('algoEngineConfig.apiLimits.points', 1);
  }
}

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
  setupApiLimiters();
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
