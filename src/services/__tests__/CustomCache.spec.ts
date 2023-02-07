import { describe, expect, it, jest } from '@jest/globals';

import { CustomCache } from '../CustomCache.js';

describe('CustomCache', () => {
    let cache: CustomCache;
    beforeEach(() => {
        cache = new CustomCache();
    });

    it('should set and get a value', () => {
        const key = 'key';
        const value = 'value';
        cache.set(key, value, 60);
        expect(cache.get(key)).toEqual(value);
    });

    it('should delete a key', () => {
        const key = 'key';
        const value = 'value';
        cache.set(key, value, 60);
        expect(cache.get(key)).toEqual(value);
        cache.del(key);
        expect(cache.get(key)).toBeUndefined();
    });

    it('should return time remaining for a key', () => {
        const key = 'key';
        const value = 'value';
        cache.set(key, value, 60);
        const timeRemaining = cache.timeRemaining(key);
        expect(timeRemaining).toBeGreaterThan(0);
    });
    it('should set a value with a timeout and expire properly', () => {
        jest.useFakeTimers();

        cache.set('key', 'value', 2);
        const value = cache.get('key');

        expect(value).toBe('value');

        jest.advanceTimersByTime(2001);
        const valueAfterTimeout = cache.get('key');

        expect(valueAfterTimeout).toBeUndefined();
    });
});
