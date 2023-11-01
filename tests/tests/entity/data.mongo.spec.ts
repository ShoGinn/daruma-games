import * as dataModel from '../../../src/entities/data.mongo.js';

describe('data.mongo.spec.ts', () => {
  describe('getData()', () => {
    test('should return the default data', async () => {
      dataModel.dataModel.findOne = jest.fn().mockResolvedValueOnce(null);
      dataModel.dataModel.findOneAndUpdate = jest.fn().mockResolvedValueOnce(null);
      const result = await dataModel.getData('maintenance');
      expect(result).toBe(false);
    });
  });
  describe('setData()', () => {
    test('should set the data', async () => {
      dataModel.dataModel.updateOne = jest.fn().mockResolvedValueOnce(null);
      await dataModel.setData('maintenance', true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(dataModel.dataModel.updateOne).toHaveBeenCalledWith(
        {},
        { $set: { 'data.maintenance': true } },
        { upsert: true },
      );
    });
  });
});
