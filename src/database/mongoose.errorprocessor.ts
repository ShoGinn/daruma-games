import { mongo } from 'mongoose';

/*
"E11000 duplicate key error collection: test.testmodels index: name_1 dup key: { name: \"test\" }"}
*/
export function isDuplicate(error: unknown): boolean {
  return (
    error instanceof mongo.MongoServerError &&
    (error.message.includes('E11000') || error.code === 11_000)
  );
}
