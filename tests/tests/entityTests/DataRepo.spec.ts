import { MikroORM } from '@mikro-orm/core';

import { Data, DataRepository, defaultData } from '../../../src/entities/Data.entity.js';
import { initDataTable } from '../../../src/services/DataRepo.js';
import { ObjectUtil } from '../../../src/utils/Utils.js';
import { initORM } from '../../utils/bootstrap.js';

describe('Data Repo', () => {
    let orm: MikroORM;
    let dataRepository: DataRepository;
    beforeAll(async () => {
        orm = await initORM();
    });
    afterAll(async () => {
        await orm.close(true);
    });
    beforeEach(async () => {
        await initDataTable();
        const db = orm.em.fork();
        dataRepository = db.getRepository(Data);
    });

    it('should initialize the data table', async () => {
        const keys = Object.keys(defaultData);
        for (const key of keys) {
            const data = await dataRepository.get(key as keyof typeof defaultData);
            expect(data).toEqual(defaultData[key as keyof typeof defaultData]);
        }
    });

    it('should handle errors', async () => {
        // intentionally breaking the connection to the database
        expect.assertions(1);
        orm.close();
        try {
            await initDataTable();
        } catch (error) {
            expect(error).toBeTruthy();
        }
        orm = await initORM();
    });
    it('should throw an error for no key', async () => {
        expect.assertions(1);
        const key = 'fakeKey';
        try {
            await dataRepository.get(key as keyof typeof defaultData);
        } catch (error) {
            expect(error).toHaveProperty('message', 'Key fakeKey does not exist');
        }
    });
    it('should throw an error if JSON parse fails', async () => {
        expect.assertions(1);
        // Mocking the findOne method to return a data object with a value that can't be parsed
        dataRepository.findOne = jest.fn().mockResolvedValue({ value: '{ invalid: json }' });

        try {
            await dataRepository.get('testKey' as keyof typeof defaultData);
        } catch (error) {
            //@ts-expect-error - error is unknown
            expect(error.message).toMatch(/Error parsing value for key testKey/);
        }
    });
    it('should throw an error when JSON parsing fails', async () => {
        expect.assertions(1);
        const data = {
            key: 'key1',
            value: '{',
            updatedAt: new Date(),
            createdAt: new Date(),
        };

        // jest.spyOn(dataRepository, 'findOne').mockResolvedValueOnce(data);

        const fakeError = { message: 'Unexpected end of JSON input' };

        jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
            throw fakeError;
        });

        const spy = jest
            .spyOn(dataRepository, 'findOne')
            .mockImplementationOnce(() => Promise.resolve(data));

        try {
            await dataRepository.get('key1' as keyof typeof defaultData);
        } catch (error) {
            //@ts-expect-error - error is unknown
            expect(error.message).toMatch(/Error parsing value for key key1/);
        }

        spy.mockRestore();
    });

    it('should update existing values', async () => {
        const key = ObjectUtil.getRandomElement(
            Object.keys(defaultData)
        ) as keyof typeof defaultData;
        await dataRepository.set(key, !defaultData[key]);
        const data = await dataRepository.get(key);
        expect(data).toEqual(!defaultData[key]);
    });
    it('should add new values using add', async () => {
        const newKey = 'brandNewKey1';
        const newValue = 35;
        await dataRepository.add(newKey as keyof typeof defaultData, newValue);
        const addedData = await dataRepository.findOne({ key: newKey });
        expect(addedData).toBeTruthy();
        expect(addedData?.value).toBe(JSON.stringify(newValue));
    });

    it('should add new values using set', async () => {
        const newKey = 'brandNewKey2';
        const newValue = 35;
        await dataRepository.set(newKey as keyof typeof defaultData, newValue);
        const addedData = await dataRepository.findOne({ key: newKey });
        expect(addedData).toBeTruthy();
        expect(addedData?.value).toBe(JSON.stringify(newValue));
    });
});
