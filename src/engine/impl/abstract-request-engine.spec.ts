/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from '@faker-js/faker';
import mockAxios, { AxiosInstance } from 'axios';

import { AbstractRequestEngine } from './abstract-request-engine.js';

jest.mock('axios');
class TestRequestEngine extends AbstractRequestEngine {
  public constructor(url: string) {
    super(url);
  }
  public getApi(): AxiosInstance {
    return this.api;
  }
}
describe('AbstractRequestEngine', () => {
  // Create a test url thats not actually used
  const testUrl = faker.internet.url();
  test('creates a new instance of AbstractRequestEngine with the correct properties', () => {
    const testRequestEngine = new TestRequestEngine(testUrl);
    expect(testRequestEngine.baseUrl).toBe(testUrl);
  });

  test('returns the default options for Axios requests', () => {
    const { baseOptions } = AbstractRequestEngine;
    expect(baseOptions.timeout).toBe(10_000);
    expect(baseOptions.validateStatus).toBeInstanceOf(Function);
    const validateStatus = baseOptions.validateStatus ?? (() => true);
    expect(validateStatus(200)).toBe(true);
    expect(validateStatus(500)).toBe(false);
  });

  test('adds an Axios interceptor to the request engine', () => {
    const testRequestEngine = new TestRequestEngine(testUrl);
    const instance = testRequestEngine.getApi();
    expect(instance.interceptors.request).toBeDefined();
  });
  test('check the apiFetch method', async () => {
    const testRequestEngine = new TestRequestEngine(testUrl);
    const mockRequest = jest.fn(() => Promise.resolve('response'));
    (mockAxios as any).get = mockRequest;
    await expect(testRequestEngine.apiFetch('url')).resolves.toBe('response');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
