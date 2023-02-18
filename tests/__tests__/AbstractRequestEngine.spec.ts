import { AxiosInstance } from 'axios';

import { AbstractRequestEngine } from '../../src/model/framework/engine/impl/AbstractRequestEngine.js';
class TestRequestEngine extends AbstractRequestEngine {
    public constructor(url: string, rateLimits?: { points: number; duration: number }) {
        super(url, undefined, rateLimits);
    }
    public testRateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
        return this.rateLimitedRequest(request);
    }
    public getApi(): AxiosInstance {
        return this.api;
    }
}
describe('AbstractRequestEngine', () => {
    it('creates a new instance of AbstractRequestEngine with the correct properties', () => {
        const testUrl = 'https://example.com';
        const api = new TestRequestEngine(testUrl);
        expect(api.baseUrl).toBe(testUrl);
    });
    it('successfully runs a RateLimitedRequest', async () => {
        const testUrl = 'https://example.com';
        const api = new TestRequestEngine(testUrl);
        const mockRequest = jest.fn(() => Promise.resolve('response'));
        await expect(api.testRateLimitedRequest(mockRequest)).resolves.toBe('response');
    });

    it('limits the rate of requests', async () => {
        const testUrl = 'https://example.com';
        const rateLimits = { points: 0, duration: 1 };
        const api = new TestRequestEngine(testUrl, rateLimits);
        const mockRequest = jest.fn(() => Promise.resolve('response'));
        await expect(api.testRateLimitedRequest(mockRequest)).rejects.toThrow('Queue is full');
    });

    it('returns the default options for Axios requests', () => {
        const baseOptions = AbstractRequestEngine.baseOptions;
        expect(baseOptions.timeout).toBe(10000);
        expect(baseOptions.validateStatus).toBeInstanceOf(Function);
        const validateStatus = baseOptions.validateStatus ?? (() => true);
        expect(validateStatus(200)).toBe(true);
        expect(validateStatus(500)).toBe(false);
    });

    it('adds an Axios interceptor to the request engine', () => {
        const testUrl = 'https://example.com';
        const api = new TestRequestEngine(testUrl);
        const instance = api.getApi();
        expect(instance.interceptors.request).toBeDefined();
    });
});
