import { container } from 'tsyringe';

import { TenorImageManager } from '../../src/model/framework/manager/TenorImage.js';

describe('TenorImageManager', () => {
    let manager: TenorImageManager;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        process.env.TENOR_API_KEY = 'test';
        manager = container.resolve(TenorImageManager);
        mockRequest = jest.fn();
        manager['rateLimitedRequest'] = mockRequest;
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

            mockRequest.mockResolvedValue(expectedResponse);

            const url = await manager.fetchRandomTenorGif(search);

            expect(url).toBe(expectedResponse);
            expect(mockRequest).toHaveBeenCalledWith(expect.any(Function));
            expect(mockRequest.mock.calls[0][0]).toBeInstanceOf(Function);
        });

        it('should handle errors', async () => {
            const search = 'sad';
            const expectedError = new Error('Server error');

            mockRequest.mockRejectedValue(expectedError);

            const error = await manager.fetchRandomTenorGif(search).catch(e => e);

            expect(error).toBe(expectedError);
        });
    });
});
