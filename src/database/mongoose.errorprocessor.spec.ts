/* eslint-disable jest/no-conditional-expect */
import mongoose, { mongo } from 'mongoose';

import { mongoFixture } from '../../tests/fixtures/mongodb-fixture.js';

import { processMongoError } from './mongoose.errorprocessor.js';

// Define the schema
const testSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

// Create the model
const testModel = mongoose.model('testModel', testSchema);
describe('Mongoose Error Processor', () => {
  it('should return a MongoError', () => {
    const error = new mongo.MongoServerError({
      message:
        'E11000 duplicate key error collection: test.testmodels index: name_1 dup key: { name: "test" }',
      code: 11_000,
    });
    const result = processMongoError(error);
    expect(result).toBeInstanceOf(mongo.MongoServerError);
    expect(result.message).toBe(error.message);
    expect(result.code).toBe(11_000);
    expect(result.name).toBe(error.name);
    expect(result.stack).toBeDefined();
    // eslint-disable-next-line unicorn/numeric-separators-style
    expect(result.code).toBe(11000);
  });
  it('should return the error if its not a mongo error', () => {
    const error = new Error('test error');
    const result = processMongoError(error);
    expect(result).toBeInstanceOf(Error);
    expect(result.code).toBeUndefined();
    expect(result.code === 11_000).toBeFalsy();
  });
});
// only enable for certain testing
describe.skip('Mongoose Error Processor with mongoose model', () => {
  mongoFixture(testModel);
  it('should return a MongoError', async () => {
    expect.assertions(2);
    const testDocument = new testModel({ name: 'test' });
    await testDocument.save();
    const result = (await testModel
      .create({ name: 'test' })
      .catch(processMongoError)) as mongo.MongoServerError;
    expect(result).toBeInstanceOf(mongo.MongoServerError);
    //ts-expect-error message is a string
    expect(result.message).toBe(
      'E11000 duplicate key error collection: test.testmodels index: name_1 dup key: { name: "test" }',
    );
  });
  it('should return the error if its not a mongo error', async () => {
    expect.assertions(2);
    const testDocument = new testModel({ name: 'test' });
    await testDocument.save();
    const result = (await testModel.create({ name: 'test' }).catch(processMongoError)) as Error;
    expect(result).toBeInstanceOf(Error);
    //ts-expect-error message is a string
    expect(result.message).toBe(
      'E11000 duplicate key error collection: test.testmodels index: name_1 dup key: { name: "test" }',
    );
  });
});
