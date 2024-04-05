/* eslint-disable jest/no-conditional-expect */
import mongoose, { mongo } from 'mongoose';

import { mongoFixture } from '../../tests/fixtures/mongodb-fixture.js';

import { isDuplicate } from './mongoose.errorprocessor.js';

// Define the schema
const testSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

// Create the model
const testModel = mongoose.model('testModel', testSchema);
describe('Mongoose Error Processor', () => {
  it('should return true', () => {
    const error = new mongo.MongoServerError({
      message:
        'E11000 duplicate key error collection: test.testmodels index: name_1 dup key: { name: "test" }',
      code: 11_000,
    });
    const result = isDuplicate(error);
    expect(result).toBe(true);
  });
  it('should return false', () => {
    const error = new Error('test error');
    const result = isDuplicate(error);
    expect(result).toBe(false);
  });
});
// only enable for certain testing
describe('Algorand Standard Asset End to End Tests', () => {
  if (process.env['RUN_E2E_TESTS'] === 'true') {
    describe('Mongoose Error Processor with mongoose model', () => {
      mongoFixture(testModel);
      it('should throw a duplicate error', async () => {
        expect.assertions(1);
        const testDocument = new testModel({ name: 'test' });
        await testDocument.save();
        const result = await testModel.create({ name: 'test' }).catch(isDuplicate);
        expect(result).toBe(true);
      });
    });
  } else {
    it('should not run', () => {
      expect(true).toBeTruthy();
    });
  }
});
