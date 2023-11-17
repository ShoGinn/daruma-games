import { getConfig } from '../../../src/config/config.js';
import { AlgoClientEngine } from '../../../src/engine/impl/algo-client-engine.js';

const config = getConfig();
class ClientForTesting extends AlgoClientEngine {
  constructor() {
    super();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _getAlgodClient(): any {
    return this.algodClient;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _getIndexerClient(): any {
    return this.indexerClient;
  }
}
describe('AlgoClientEngine', () => {
  const configCopy = config.getProperties();
  beforeEach(() => {
    config.load(configCopy);
    jest.resetModules();
  });
  test('throw error when api is not given', () => {
    expect.assertions(1);
    const server = 'https://testnet-api.algoexplorer.io';
    config.load({
      algoEngineConfig: {
        algod: {
          server,
        },
        indexer: {
          server,
        },
      },
    });
    expect(() => new ClientForTesting()).toThrow('Algo API Token is required');
  });

  test('logs the correct default connection types', () => {
    const _algoClientEngine = new ClientForTesting();

    const algodClient = _algoClientEngine._getAlgodClient();
    const indexerClient = _algoClientEngine._getIndexerClient();
    expect(algodClient.c.bc.baseURL.toString()).toMatch('https://mainnet-api.algonode.cloud/');
    expect(indexerClient.c.bc.baseURL.toString()).toMatch('https://mainnet-idx.algonode.cloud/');
    expect(algodClient.c.bc).toMatchObject({
      baseURL: expect.any(URL),
      defaultHeaders: {},
      tokenHeader: {},
    });
    expect(indexerClient.c.bc).toMatchObject({
      baseURL: expect.any(URL),
      defaultHeaders: {},
      tokenHeader: {},
    });
  });
  test('logs the correct connection types', () => {
    const token = 'token';
    const server = 'https://testnet-api.algoexplorer.io';
    config.load({
      algoEngineConfig: {
        algoApiToken: token,
        algod: {
          server,
        },
        indexer: {
          server,
        },
      },
    });
    const _algoClientEngine = new ClientForTesting();

    const algodClient = _algoClientEngine._getAlgodClient();
    const indexerClient = _algoClientEngine._getIndexerClient();
    expect(algodClient.c.bc.baseURL.toString()).toMatch(server);
    expect(indexerClient.c.bc.baseURL.toString()).toMatch(server);
    expect(algodClient.c.bc).toMatchObject({
      baseURL: expect.any(URL),
      defaultHeaders: {},
      tokenHeader: {
        'X-Algo-API-Token': token,
      },
    });
    expect(indexerClient.c.bc).toMatchObject({
      baseURL: expect.any(URL),
      defaultHeaders: {},
      tokenHeader: {
        'X-Indexer-API-Token': token,
      },
    });
  });
});
