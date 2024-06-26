import NodeCache from 'node-cache';

import { CustomCache } from '../../src/services/custom-cache.js';

export const mockCustomCache: CustomCache = {
  cache: {} as unknown as NodeCache,
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getFromCacheOrFetch: jest.fn(),
  timeRemaining: jest.fn(),
  humanTimeRemaining: jest.fn(),
};

//* Use the below code to mock the CustomCache class
// jest.mock('../../services/CustomCache', () => ({
//     CustomCache: jest.fn().mockImplementation(() => mockCustomCache),
// }));
//* Use the Above code to mock the CustomCache class
