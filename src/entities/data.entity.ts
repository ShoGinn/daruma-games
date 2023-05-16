import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './base.entity.js';

/**
 * Default data for the Data table (dynamic EAV key/value pattern)
 */
export const defaultData = {
    maintenance: false,
    lastMaintenance: Date.now(),
    lastStartup: Date.now(),
};

type DataType = keyof typeof defaultData;

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ customRepository: () => DataRepository })
export class Data extends CustomBaseEntity {
    [EntityRepositoryType]?: DataRepository;

    @PrimaryKey()
    key!: string;

    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
    @Property()
    value: string = '';
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DataRepository extends EntityRepository<Data> {
    /**
     * Get a value from the Data table
     * If the key does not exists it will throw an error
     *
     * @template T
     * @param {T} key
     * @returns {*}  {Promise<(typeof defaultData)[T]>}
     * @memberof DataRepository
     */
    async get<T extends DataType>(key: T): Promise<(typeof defaultData)[T]> {
        const data = await this.findOne({ key });
        if (!data) {
            throw new Error(`Key ${key} does not exist`);
        }
        try {
            return JSON.parse(data.value);
        } catch (error) {
            const error_ =
                error instanceof Error
                    ? new Error(`Error parsing value for key ${key}: ${error.message}`)
                    : new Error(`Error parsing value for key ${key}`);
            throw error_;
        }
    }

    /**
     * Set a key/value pair in the Data table
     * If the key does not exist, it will be added
     *
     * @template T
     * @param {T} key
     * @param {unknown} value
     * @returns {*}  {Promise<void>}
     * @memberof DataRepository
     */
    async set<T extends DataType>(key: T, value: unknown): Promise<void> {
        const data = await this.findOne({ key });
        const em = this.getEntityManager();

        if (!data) {
            const newData = new Data();
            newData.key = key;
            newData.value = JSON.stringify(value as (typeof defaultData)[T]);

            await em.persistAndFlush(newData);
            return;
        }
        data.value = JSON.stringify(value as (typeof defaultData)[T]);
        await em.flush();
    }

    /**
     * Add a new key/value pair to the Data table
     * If the key already exists, it will not be added
     *
     * @template T
     * @param {T} key
     * @param {unknown} value
     * @returns {*}  {Promise<void>}
     * @memberof DataRepository
     */
    async add<T extends DataType>(key: T, value: unknown): Promise<void> {
        const data = await this.findOne({ key });
        const em = this.getEntityManager();

        if (data) {
            return;
        }
        const newData = new Data();
        newData.key = key;
        newData.value = JSON.stringify(value as (typeof defaultData)[T]);

        await em.persistAndFlush(newData);
    }
}
