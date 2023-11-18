import mockAxios from 'axios';

import { getConfig } from '../config/config.js';
import { imageHosting } from '../utils/functions/dt-images.js';

import { TenorImageManager } from './tenor-image.js';

jest.mock('axios');
describe('TenorImageManager', () => {
  let manager: TenorImageManager;
  let mockRequest: jest.Mock;
  beforeEach(() => {
    getConfig().set('tenorApiKey', 'test-api-config');
    manager = new TenorImageManager();
    mockRequest = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAxios as any).get = mockRequest;
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('TenorImageManager', () => {
    test('should return failed image without an API key', async () => {
      getConfig().set('tenorApiKey', '');
      const manager = new TenorImageManager();
      const fetchedImage = await manager.fetchRandomTenorGif('sad');
      expect(fetchedImage).toBe(imageHosting.failedImage);
    });
  });

  describe('fetchRandomTenorGif', () => {
    test('should fetch a random image based upon a search', async () => {
      const search = 'sad';
      const expectedUrl = 'https://example.com/image.gif';
      const expectedResponse = {
        data: {
          results: [
            {
              media_formats: { tinygif: { url: expectedUrl } },
            },
          ],
        },
      };
      mockRequest.mockResolvedValue(expectedResponse);

      const url = await manager.fetchRandomTenorGif(search);

      expect(url).toBe(expectedUrl);
    });
    test('should return failed image when no searches found', async () => {
      const search = 'randomStuff';
      const expectedUrl = imageHosting.failedImage;
      const expectedResponse = {
        data: {
          results: [''],
        },
      };
      mockRequest.mockResolvedValue(expectedResponse);

      const url = await manager.fetchRandomTenorGif(search);

      expect(url).toBe(expectedUrl);
    });

    test('should handle errors', async () => {
      const search = 'sad';
      const expectedError = new Error('Server error');
      manager['rateLimitedRequest'] = mockRequest;

      mockRequest.mockRejectedValue(expectedError);

      const error = await manager.fetchRandomTenorGif(search).catch((error_) => error_);

      expect(error).toBe(expectedError);
    });
  });
});
