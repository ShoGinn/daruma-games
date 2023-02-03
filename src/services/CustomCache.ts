import NodeCache from 'node-cache';
import { singleton } from 'tsyringe';

import logger from '../utils/functions/LoggerFactory.js';

@singleton()
export class CustomCache {
    private readonly cache = new NodeCache({ useClones: false });

    public get<T>(key: string): T | undefined {
        try {
            return this.cache.get<T>(key);
        } catch (error) {
            logger.error('Error occurred while getting value from cache: ', error);
            return undefined;
        }
    }

    /**
     * Set a value in the cache
     *
     * @template T
     * @param {string} key
     * @param {T} value
     * @param {number} ttl - Time to live in seconds
     * @returns {*}  {boolean}
     * @memberof CustomCache
     */
    public set<T>(key: string, value: T, ttl: number): boolean {
        try {
            return this.cache.set(key, value, ttl);
        } catch (error) {
            logger.error('Error occurred while setting value in cache: ', error);
            return false;
        }
    }

    public del(key: string): number {
        try {
            return this.cache.del(key);
        } catch (error) {
            logger.error('Error occurred while deleting key from cache: ', error);
            return 0;
        }
    }
    public timeRemaining(key: string): number {
        try {
            return this.cache.getTtl(key) ?? 0;
        } catch (error) {
            logger.error('Error occurred while getting time remaining for key: ', error);
            return 0;
        }
    }
}
