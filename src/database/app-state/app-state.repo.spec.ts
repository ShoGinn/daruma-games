import { mongoFixture } from '../../../tests/fixtures/mongodb-fixture.js';

import { appStateModel } from './app-state.js';
import { AppStateRepository } from './app-state.repo.js';
import { defaultAppStates } from './app-state.schema.js';

describe('App State Repository', () => {
  mongoFixture(appStateModel);
  let appStateRepo: AppStateRepository;
  beforeAll(() => {
    appStateRepo = new AppStateRepository();
  });
  describe('getOrInitializeDataDocument', () => {
    it('should return existing document', async () => {
      const document = await appStateModel.create({});
      const result = await appStateRepo.getOrInitializeDataDocument();
      expect(result._id).toEqual(document._id);
    });
    it('should return new document if none exists', async () => {
      const result = await appStateRepo.getOrInitializeDataDocument();
      expect(result).not.toBeNull();
      expect(result.maintenance).toEqual(defaultAppStates.maintenance);
    });
  });
  describe('readData', () => {
    it('should return value if exists', async () => {
      await appStateModel.create({ maintenance: true });
      const result = await appStateRepo.readData('maintenance');
      expect(result).toBe(true);
    });
    it('should create the document and return the value', async () => {
      const result = await appStateRepo.readData('maintenance');
      expect(result).toEqual(defaultAppStates.maintenance);
      const document = await appStateModel.findOne({});
      expect(document).not.toBeNull();
    });
    it('should have a problem where mongo returns nothing and still returns default', async () => {
      const spyed = jest.spyOn(appStateModel, 'findOneAndUpdate');
      spyed.mockResolvedValueOnce(null);
      const result = await appStateRepo.readData('maintenance');
      expect(result).toEqual(defaultAppStates.maintenance);
    });
  });
  describe('writeData', () => {
    it('should write the data', async () => {
      await appStateRepo.writeData('maintenance', true);
      const document = await appStateModel.findOne({});
      expect(document?.maintenance).toBe(true);
    });
  });
  describe('Bulk Activities', () => {
    describe('readDataBulk', () => {
      it('should return the data', async () => {
        await appStateModel.create({ maintenance: true });
        const result = await appStateRepo.readDataBulk(['maintenance']);
        expect(result).toEqual({ maintenance: true });
      });
      it('should return the default if nothing exists', async () => {
        const result = await appStateRepo.readDataBulk(['maintenance']);
        expect(result).toEqual({ maintenance: false });
      });
      it('should return multiple data', async () => {
        await appStateModel.create({ maintenance: true });
        const result = await appStateRepo.readDataBulk(['maintenance', 'maintenance']);
        expect(result).toEqual({ maintenance: true });
      });
      it('should have a problem where mongo returns nothing and still returns default', async () => {
        const spyed = jest.spyOn(appStateModel, 'findOneAndUpdate');
        spyed.mockResolvedValueOnce(null);
        const result = await appStateRepo.readDataBulk(['maintenance']);
        expect(result).toEqual({ maintenance: false });
      });
    });
    describe('writeDataBulk', () => {
      it('should write the data', async () => {
        await appStateRepo.writeDataBulk({ maintenance: true });
        const document = await appStateModel.findOne({});
        expect(document?.maintenance).toBe(true);
      });
    });
  });
});
