import { clearPropertyCache } from '../../src/model/framework/decorators/Property.js';
import { TenorImageManager } from '../../src/model/framework/manager/TenorImage.js';
import { imageHosting } from '../../src/utils/functions/dtImages.js';

describe('TenorImageManager', () => {
    it('should return failed image without an API key', () => {
        const manager = new TenorImageManager();
        expect(manager.fetchRandomTenorGif('sad')).resolves.toBe(imageHosting.failedImage);
    });
});
describe('TenorImageManager', () => {
    let manager: TenorImageManager;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        clearPropertyCache();
        process.env.TENOR_API_KEY = 'test';
        manager = new TenorImageManager();
        mockRequest = jest.fn();
    });

    describe('fetchRandomTenorGif', () => {
        it('should fetch a random image based upon a search', async () => {
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
            manager['apiFetch'] = jest.fn().mockResolvedValue(expectedResponse);
            mockRequest.mockResolvedValue(expectedResponse);

            const url = await manager.fetchRandomTenorGif(search);

            expect(url).toBe(expectedUrl);
        });
        it('should return failed image when no searches found', async () => {
            const search = 'randomStuff';
            const expectedUrl = imageHosting.failedImage;
            const expectedResponse = {
                data: {
                    results: [],
                },
            };
            manager['apiFetch'] = jest.fn().mockResolvedValue(expectedResponse);
            mockRequest.mockResolvedValue(expectedResponse);

            const url = await manager.fetchRandomTenorGif(search);

            expect(url).toBe(expectedUrl);
        });

        it('should handle errors', async () => {
            const search = 'sad';
            const expectedError = new Error('Server error');
            manager['rateLimitedRequest'] = mockRequest;

            mockRequest.mockRejectedValue(expectedError);

            const error = await manager.fetchRandomTenorGif(search).catch(e => e);

            expect(error).toBe(expectedError);
        });
    });
});
