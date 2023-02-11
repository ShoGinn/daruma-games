import NodeCache from 'node-cache';
import { singleton } from 'tsyringe';

import logger from '../utils/functions/LoggerFactory.js';
import { ObjectUtil } from '../utils/Utils.js';

@singleton()
export class CustomCache {
    public readonly cache = new NodeCache({ useClones: false, stdTTL: 3_600 });

    /**
     * Get a value from the cache
     *
     * @template T
     * @param {string} key
     * @returns {*}  {(T | undefined)}
     * @memberof CustomCache
     */
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
     * @param {number} [ttl]
     * @returns {*}  {boolean}
     * @memberof CustomCache
     */
    public set<T>(key: string, value: T, ttl?: number): boolean {
        try {
            return this.cache.set(key, value, ttl ?? '');
        } catch (error) {
            logger.error('Error occurred while setting value in cache: ', error);
            return false;
        }
    }

    /**
     * Delete a key from the cache
     *
     * @param {string} key
     * @returns {*}  {number}
     * @memberof CustomCache
     */
    public del(key: string): number {
        try {
            return this.cache.del(key);
        } catch (error) {
            logger.error('Error occurred while deleting key from cache: ', error);
            return 0;
        }
    }

    /**
     * Get the time remaining for a key
     *
     * @param {string} key
     * @returns {*}  {number} TimeStamp in MS
     * @memberof CustomCache
     */
    public timeRemaining(key: string): number | undefined {
        try {
            return this.cache.getTtl(key);
        } catch (error) {
            logger.error('Error occurred while getting time remaining for key: ', error);
            return 0;
        }
    }
    public humanTimeRemaining(key: string): string {
        try {
            return ObjectUtil.timeAgo(this.timeRemaining(key));
        } catch (error) {
            logger.error('Error occurred while getting time remaining for key: ', error);
            return '0s';
        }
    }
}
