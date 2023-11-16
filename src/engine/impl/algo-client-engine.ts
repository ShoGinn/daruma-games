import algosdk from 'algosdk';
import type { CustomTokenHeader } from 'algosdk/dist/types/client/urlTokenBaseHTTPClient.js';

import { getConfig } from '../../config/config.js';

import { WrappedIndexer } from './wrapped-indexer.js';

const config = getConfig();

export abstract class AlgoClientEngine {
  protected algodClient: algosdk.Algodv2;
  protected indexerClient: algosdk.Indexer;
  protected algoEngineConfig = config.get('algoEngineConfig');
  protected constructor() {
    const token = this.setupApiToken();
    this.algodClient = new algosdk.Algodv2(
      token,
      this.algoEngineConfig.algod.server,
      this.algoEngineConfig.algod.port || '',
    );
    this.indexerClient = new WrappedIndexer(
      token,
      this.algoEngineConfig.indexer.server,
      this.algoEngineConfig.indexer.port || '',
    );
  }
  private setupApiToken(): string | CustomTokenHeader {
    const apiToken = this.algoEngineConfig.algoApiToken;
    const { server } = this.algoEngineConfig.algod;
    // Algonode does not require an API token
    // If you do have one, it will be used.
    if (server.includes('algonode')) {
      return apiToken || '';
    }
    // All other servers require an API token
    if (!apiToken) {
      throw new Error('Algo API Token is required');
    }
    return apiToken;
  }
}
