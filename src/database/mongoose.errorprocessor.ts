import { mongo } from 'mongoose';

/*
"E11000 duplicate key error collection: test.testmodels index: name_1 dup key: { name: \"test\" }"}
*/
export function processMongoError(error: unknown): mongo.MongoServerError {
  if (
    error instanceof mongo.MongoError && // Check for MongoDB duplicate key error
    (error.message.includes('E11000') || error.code === 11_000)
  ) {
    return error;
  }
  return error as mongo.MongoServerError;
}
