import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { Data, defaultData } from '../entities/data.entity.js';

type DataType = keyof typeof defaultData;

/**
 * Initiate the EAV Data table if properties defined in the `defaultData` doesn't exist in it yet.
 *
 * @returns {*}  {Promise<void>}
 */
export async function initDataTable(): Promise<void> {
    const database = container.resolve(MikroORM).em.fork();

    for (const key of Object.keys(defaultData)) {
        const dataRepository = database.getRepository(Data);

        await dataRepository.add(key as DataType, defaultData[key as DataType]);
    }
}
