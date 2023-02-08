import {
    Entity,
    EntityRepository,
    EntityRepositoryType,
    PrimaryKey,
    Property,
} from '@mikro-orm/core';

import { CustomBaseEntity } from './BaseEntity.entity.js';

/**
 * Default data for the Data table (dynamic EAV key/value pattern)
 */
export const defaultData = {
    maintenance: false,
    lastMaintenance: Date.now(),
    lastStartup: Date.now(),
    userAssetSync: Date.now() - Date.now() + 1,
    creatorAssetSync: Date.now() - Date.now() + 1,
    botNPCsCreated: false,
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
            if (error instanceof Error) {
                throw new Error(`Error parsing value for key ${key}: ${error.message}`);
            } else {
                throw new Error(`Error parsing value for key ${key}`);
            }
        }
    }

    /**
     * Set a key/value pair in the Data table
     * If the key does not exist, it will be added
     *
     * @template T
     * @param {T} key
     * @param {(typeof defaultData)[T]} value
     * @returns {*}  {Promise<void>}
     * @memberof DataRepository
     */
    async set<T extends DataType>(key: T, value: (typeof defaultData)[T]): Promise<void> {
        const data = await this.findOne({ key });

        if (!data) {
            const newData = new Data();
            newData.key = key;
            newData.value = JSON.stringify(value);

            await this.persistAndFlush(newData);
            return;
        }
        data.value = JSON.stringify(value);
        await this.flush();
    }

    /**
     * Add a new key/value pair to the Data table
     * If the key already exists, it will not be added
     *
     * @template T
     * @param {T} key
     * @param {(typeof defaultData)[T]} value
     * @returns {*}  {Promise<void>}
     * @memberof DataRepository
     */
    async add<T extends DataType>(key: T, value: (typeof defaultData)[T]): Promise<void> {
        const data = await this.findOne({ key });

        if (data) {
            return;
        }
        const newData = new Data();
        newData.key = key;
        newData.value = JSON.stringify(value);

        await this.persistAndFlush(newData);
    }
}
