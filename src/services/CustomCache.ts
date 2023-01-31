import NodeCache from 'node-cache';
import { singleton } from 'tsyringe';

@singleton()
export class CustomCache {
    private readonly cache = new NodeCache({ useClones: false });

    public get<T>(key: string): T | undefined {
        return this.cache.get<T>(key);
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
        return this.cache.set(key, value, ttl);
    }

    public del(key: string): number {
        return this.cache.del(key);
    }
    public timeRemaining(key: string): number {
        return this.cache.getTtl(key) ?? 0;
    }
}
