/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from '@faker-js/faker';
import mockAxios, { AxiosInstance } from 'axios';

import { AbstractRequestEngine } from '../../src/model/framework/engine/impl/abstract-request-engine.js';
jest.mock('axios');
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
    // Create a test url thats not actually used
    const testUrl = faker.internet.url();
    it('creates a new instance of AbstractRequestEngine with the correct properties', () => {
        const testRequestEngine = new TestRequestEngine(testUrl);
        expect(testRequestEngine.baseUrl).toBe(testUrl);
    });
    it('successfully runs a RateLimitedRequest', async () => {
        const testRequestEngine = new TestRequestEngine(testUrl);
        const mockRequest = jest.fn(() => Promise.resolve('response'));
        await expect(testRequestEngine.testRateLimitedRequest(mockRequest)).resolves.toBe(
            'response'
        );
    });

    it('limits the rate of requests', async () => {
        const rateLimits = { points: 0, duration: 1 };
        const testRequestEngine = new TestRequestEngine(testUrl, rateLimits);
        const mockRequest = jest.fn(() => Promise.resolve('response'));
        await expect(testRequestEngine.testRateLimitedRequest(mockRequest)).rejects.toThrow(
            'Requested tokens 1 exceeds maximum 0 tokens per interval'
        );
    });

    it('returns the default options for Axios requests', () => {
        const baseOptions = AbstractRequestEngine.baseOptions;
        expect(baseOptions.timeout).toBe(10_000);
        expect(baseOptions.validateStatus).toBeInstanceOf(Function);
        const validateStatus = baseOptions.validateStatus ?? (() => true);
        expect(validateStatus(200)).toBe(true);
        expect(validateStatus(500)).toBe(false);
    });

    it('adds an Axios interceptor to the request engine', () => {
        const testRequestEngine = new TestRequestEngine(testUrl);
        const instance = testRequestEngine.getApi();
        expect(instance.interceptors.request).toBeDefined();
    });
    it('check the apiFetch method', async () => {
        const testRequestEngine = new TestRequestEngine(testUrl);
        const mockRequest = jest.fn(() => Promise.resolve('response'));
        (mockAxios as any).get = mockRequest;
        await expect(testRequestEngine.apiFetch('url')).resolves.toBe('response');
        expect(mockRequest).toBeCalledTimes(1);
    });
});
