import { faker } from '@faker-js/faker';

import { CustomCache } from './custom-cache.js';

describe('CustomCache', () => {
  let cache: CustomCache;
  let key: string;
  let value: string | undefined;
  beforeEach(() => {
    key = faker.word.sample();
    value = faker.word.sample();
    cache = new CustomCache();
  });
  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  test('should set and get a value without ttl', () => {
    cache.set(key, value);
    expect(cache.get(key)).toEqual(value);
  });
  test('should set and get a value with ttl', () => {
    const ttl = 60; // 60 seconds
    cache.set(key, value, ttl);
    expect(cache.get(key)).toEqual(value);
  });

  test('should delete a key', () => {
    cache.set(key, value);
    expect(cache.get(key)).toEqual(value);
    cache.del(key);
    expect(cache.get(key)).toBeUndefined();
  });

  test('should return undefined for a non-existent key', () => {
    expect(cache.get('none')).toBeUndefined();
    expect(cache.timeRemaining('none')).toBeUndefined();
  });
  describe('getFromCacheOrFetch', () => {
    test('should get a value from the cache', async () => {
      cache.set(key, value);
      const fetcher = jest.fn();
      const result = await cache.getFromCacheOrFetch(key, fetcher);
      expect(result).toEqual(value);
      expect(fetcher).not.toHaveBeenCalled();
    });
    test('should fetch a value and set it in the cache', async () => {
      const fetcher = jest.fn().mockResolvedValue(value);
      const result = await cache.getFromCacheOrFetch(key, fetcher);
      expect(result).toEqual(value);
      expect(fetcher).toHaveBeenCalled();
      expect(cache.get(key)).toEqual(value);
    });
  });
  test('should return the correct epoch time for a key', () => {
    const ttl = 60; // 60 seconds
    cache.set(key, value, ttl);

    const expectedExpiry = Date.now() + ttl * 1000;
    const actualExpiry = cache.timeRemaining(key);

    expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 10);
    expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 10);
  });
  test('should return the correct human time for a key', () => {
    cache.set(key, value);

    const expiry = cache.humanTimeRemaining(key);
    expect(expiry).toBe('in an hour');
  });

  describe('ttl handling', () => {
    test('should set a value with a ttl of 0 (no expire)', () => {
      jest.useFakeTimers();
      cache.set(key, value, 0);
      value = cache.get(key);
      expect(value).toBe(value);
      jest.advanceTimersByTime(Number.MAX_SAFE_INTEGER);
      const valueAfterTimeout = cache.get(key);
      expect(valueAfterTimeout).toEqual(value);
      const ttl = cache.timeRemaining(key);
      expect(ttl).toBe(0);
    });

    test('should set a value without a ttl and expire properly after 1 hour', () => {
      jest.useFakeTimers();
      cache.set(key, value);
      value = cache.get(key);

      expect(value).toBe(value);

      jest.advanceTimersByTime(3_600_001);
      const valueAfterTimeout = cache.get(key);

      expect(valueAfterTimeout).toBeUndefined();
    });
    test('should set a value with a ttl and expire properly after 2 seconds', () => {
      jest.useFakeTimers();

      cache.set(key, value, 2);
      value = cache.get(key);

      expect(value).toBe(value);

      jest.advanceTimersByTime(2001);
      const valueAfterTimeout = cache.get(key);

      expect(valueAfterTimeout).toBeUndefined();
    });
  });
});
