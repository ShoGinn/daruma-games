import { MikroORM } from '@mikro-orm/core';

import { Data, defaultData } from '../../entities/Data.entity.js';
import { initORM } from '../../tests/utils/bootstrap.js';
import { initDataTable } from '../DataRepo.js';

describe('Data Repo', () => {
    let orm: MikroORM;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });

    it('should initialize the data table', async () => {
        await initDataTable();

        const db = orm.em.fork();
        const dataRepository = db.getRepository(Data);
        const keys = Object.keys(defaultData);
        for (const key of keys) {
            const data = await dataRepository.get(key as keyof typeof defaultData);
            expect(data).toEqual(defaultData[key as keyof typeof defaultData]);
        }
    });

    it('should handle errors', async () => {
        // intentionally breaking the connection to the database
        orm.close();
        try {
            await initDataTable();
        } catch (error) {
            expect(error).toBeTruthy();
        }
        orm = await initORM();
    });

    it('should update existing values', async () => {
        await initDataTable();

        const db = orm.em.fork();
        const dataRepository = db.getRepository(Data);
        const key = 'maintenance';
        await dataRepository.set(key as keyof typeof defaultData, !defaultData[key]);
        const data = await dataRepository.get(key as keyof typeof defaultData);
        expect(data).toEqual(!defaultData[key]);
    });
    it('should add new values using set', async () => {
        await initDataTable();

        const db = orm.em.fork();
        const dataRepository = db.getRepository(Data);
        const newKey = 'brandNewKey';
        const newValue = 35;
        await dataRepository.set(newKey as keyof typeof defaultData, newValue);
        const addedData = await dataRepository.findOne({ key: newKey });
        expect(addedData).toBeTruthy();
        expect(addedData?.value).toBe(JSON.stringify(newValue));
    });
});
