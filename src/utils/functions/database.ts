import { Data, defaultData } from '../../entities/Data.js';
import { Database } from '../../services/Database.js';
import { resolveDependency } from './dependency.js';

type DataType = keyof typeof defaultData;

/**
 * Initiate the EAV Data table if properties defined in the `defaultData` doesn't exist in it yet.
 */
export async function initDataTable(): Promise<void> {
    const db = await resolveDependency(Database);

    for (const key of Object.keys(defaultData)) {
        const dataRepository = db.get(Data);

        await dataRepository.add(key as DataType, defaultData[key as DataType]);
    }
}
