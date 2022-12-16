import { MikroORM } from '@mikro-orm/core';
import { container } from 'tsyringe';

import { Data, defaultData } from '../../entities/Data.js';

type DataType = keyof typeof defaultData;

/**
 * Initiate the EAV Data table if properties defined in the `defaultData` doesn't exist in it yet.
 */
export async function initDataTable(): Promise<void> {
    const db = container.resolve(MikroORM).em.fork();

    for (const key of Object.keys(defaultData)) {
        const dataRepository = db.getRepository(Data);

        await dataRepository.add(key as DataType, defaultData[key as DataType]);
    }
}
