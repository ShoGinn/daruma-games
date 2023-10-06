import { getConfig, setupApiLimiters } from '../../src/config/config.js';
import { AlgoClientEngine } from '../../src/model/framework/engine/impl/algo-client-engine.js';
import { RateLimiter } from '../../src/model/logic/rate-limiter.js';
const config = getConfig();
class ClientForTesting extends AlgoClientEngine {
  constructor() {
    super();
  }
  public testRateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
    return this.rateLimitedRequest(request);
  }

  _checkLimiter(): RateLimiter {
    return this.limiter;
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
  it('throw error when api is not given', () => {
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
    expect(() => new ClientForTesting()).toThrowError('Algo API Token is required');
  });

  it('logs the correct default connection types', () => {
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

    const limiter = _algoClientEngine._checkLimiter();
    expect(limiter).toHaveProperty(
      'limiter._limiterFlexible._points',
      config.get('algoEngineConfig.apiLimits.points'),
    );
    expect(limiter).toHaveProperty(
      'limiter._limiterFlexible._duration',
      config.get('algoEngineConfig.apiLimits.duration'),
    );
  });
  it('logs the correct connection types for none-purestake', () => {
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
    setupApiLimiters();
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

    const limiter = _algoClientEngine._checkLimiter();
    expect(limiter).toHaveProperty('limiter._limiterFlexible._points', 1);
    expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', 1);
  });
  it('logs the correct connection types for purestake', () => {
    const token = 'token';
    const server = 'https://testnet-algorand.api.purestake.io/ps2';
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
        'X-API-Key': token,
      },
    });
    expect(indexerClient.c.bc).toMatchObject({
      baseURL: expect.any(URL),
      defaultHeaders: {},
      tokenHeader: {
        'X-API-Key': token,
      },
    });

    // const limiter = _algoClientEngine._checkLimiter();
    // expect(limiter).toHaveProperty('limiter._limiterFlexible._points', 9);
    // expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', 1);
  });
  it('successfully runs a RateLimitedRequest', async () => {
    const api = new ClientForTesting();
    const mockRequest = jest.fn(() => Promise.resolve('response'));
    await expect(api.testRateLimitedRequest(mockRequest)).resolves.toBe('response');
  });

  it('limits the rate of requests', async () => {
    const token = 'token';
    const server = 'https://testnet-api.algoexplorer.io';
    const ports = '1234';
    const limits = '0';
    config.load({
      algoEngineConfig: {
        algoApiToken: token,
        algod: {
          server,
          port: ports,
        },
        indexer: {
          server,
          port: ports,
        },
        apiLimits: {
          points: limits,
          duration: limits,
        },
      },
    });

    const _algoClientEngine = new ClientForTesting();

    const limiter = _algoClientEngine._checkLimiter();
    expect(limiter).toHaveProperty('limiter._limiterFlexible._points', Number(limits));
    expect(limiter).toHaveProperty('limiter._limiterFlexible._duration', Number(limits));

    const mockRequest = jest.fn(() => Promise.resolve('response'));

    await expect(_algoClientEngine.testRateLimitedRequest(mockRequest)).rejects.toThrow(
      'Requested tokens 1 exceeds maximum 0 tokens per interval',
    );
  });
});
