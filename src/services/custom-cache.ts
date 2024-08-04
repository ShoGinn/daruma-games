import NodeCache from 'node-cache';
import { singleton } from 'tsyringe';

import { ObjectUtil } from '../utils/classes/object-utils.js';

@singleton()
export class CustomCache {
  public readonly cache = new NodeCache({ useClones: false, stdTTL: 3600 });

  /**
   * Get a value from the cache
   *
   * @template T
   * @param {string} key
   * @returns {*}  {(T | undefined)}
   * @memberof CustomCache
   */
  public get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Set a value in the cache
   *
   * @template T
   * @param {string} key
   * @param {T} value
   * @param {number} [ttl] Time to live in seconds (default 1 hour: 3_600)
   * @returns {*}  {boolean}
   * @memberof CustomCache
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set<T>(key, value, ttl ?? '');
  }

  /**
   * Delete a key from the cache
   *
   * @param {string} key
   * @returns {*}  {number}
   * @memberof CustomCache
   */
  public del(key: string): number {
    return this.cache.del(key);
  }
  /**
   *  Get a value from the cache or fetch it if it doesn't exist
   * @param {string} key
   * @param {() => Promise<T>} fetcher
   * @param {number} ttl
   * @returns {*}  {Promise<T>}
   */
  async getFromCacheOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600,
  ): Promise<T> {
    let data = this.get<T>(key);
    if (!data) {
      data = await fetcher();
      this.set(key, data, ttl);
    }
    return data;
  }
  /**
   * Get the time remaining for a key
   *
   * @param {string} key
   * @returns {*}  {number} TimeStamp in MS
   * @memberof CustomCache
   */
  public timeRemaining(key: string): number | undefined {
    return this.cache.getTtl(key);
  }
  public humanTimeRemaining(key: string): string {
    return ObjectUtil.timeAgo(this.timeRemaining(key));
  }
}
