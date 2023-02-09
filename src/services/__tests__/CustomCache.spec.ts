import { describe, expect, it, jest } from '@jest/globals';

import logger from '../../utils/functions/LoggerFactory.js';
import { CustomCache } from '../CustomCache.js';
jest.mock('../../utils/functions/LoggerFactory.js', () => {
    return {
        error: jest.fn(),
    };
});

describe('CustomCache', () => {
    let cache: CustomCache;
    beforeEach(() => {
        cache = new CustomCache();
        (logger.error as jest.Mock).mockReset();
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

    it('get should throw error', () => {
        // mock the underlying cache to throw an error
        jest.spyOn(cache.cache, 'get').mockImplementation(() => {
            throw new Error('Error getting value from cache');
        });
        const result = cache.get('key');

        expect(logger.error).toHaveBeenCalledWith(
            'Error occurred while getting value from cache: ',
            new Error('Error getting value from cache')
        );
        expect(result).toBeUndefined();
    });

    it('set should throw error', () => {
        // mock the underlying cache to throw an error
        jest.spyOn(cache.cache, 'set').mockImplementation(() => {
            throw new Error('Error setting value in cache');
        });
        const result = cache.set('key', 'value');

        expect(logger.error).toHaveBeenCalledWith(
            'Error occurred while setting value in cache: ',
            new Error('Error setting value in cache')
        );
        expect(result).toBeFalsy();
    });

    it('del should throw error', () => {
        // mock the underlying cache to throw an error
        jest.spyOn(cache.cache, 'del').mockImplementation(() => {
            throw new Error('Error deleting key from cache');
        });
        const result = cache.del('key');

        expect(logger.error).toHaveBeenCalledWith(
            'Error occurred while deleting key from cache: ',
            new Error('Error deleting key from cache')
        );
        expect(result).toBe(0);
    });

    it('timeRemaining should throw error', () => {
        // mock the underlying cache to throw an error
        jest.spyOn(cache.cache, 'getTtl').mockImplementation(() => {
            throw new Error('Error getting time remaining for key');
        });
        const result = cache.timeRemaining('key');

        expect(logger.error).toHaveBeenCalledWith(
            'Error occurred while getting time remaining for key: ',
            new Error('Error getting time remaining for key')
        );
        expect(result).toBe(0);
    });
});
