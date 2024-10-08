/* eslint-disable jest/no-commented-out-tests */
import mongoose from 'mongoose';

import { getConfig } from '../config/config.js';

import { convertToPlainObject, databasePing } from './mongoose.js';

jest.mock('mongoose', () => {
  return {
    connect: jest.fn(),
    connection: {
      on: jest.fn(),
      once: jest.fn(),
      db: {
        command: jest.fn(),
      },
    },
  };
});
describe('Mongo Db Connection with Mongoose', () => {
  const config = getConfig();
  config.set('mongodbUri', 'mongodb://username:password@localhost:27017/db');
  config.set('nodeEnv', 'not_test');
  // const mongooseConnectSpyOn = jest
  //   .spyOn<Mongoose, 'connect'>(mongoose, 'connect')
  //   .mockImplementationOnce((_uris: string) => {
  //     return Promise.resolve(mongoose);
  //   });

  // const mongooseConnectionOnSpyOn = jest
  //   .spyOn<Connection, 'on'>(mongoose.connection, 'on')
  //   .mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });
  // describe('mongooseConnect', () => {
  //   it('should connect to mongoose when called', async () => {
  //     await mongooseConnect();
  //     // Trigger the 'connected' event handler
  //     mongooseConnectionOnSpyOn.mock.calls[0]![1]();

  //     // Trigger the 'disconnected' event handler
  //     mongooseConnectionOnSpyOn.mock.calls[1]![1]();
  //     expect(mongooseConnectSpyOn).toHaveBeenCalledTimes(1);
  //     expect(mongooseConnectSpyOn).toHaveBeenCalledWith(
  //       'mongodb://username:password@localhost:27017/db',
  //     );
  //     expect(mongooseConnectionOnSpyOn).toHaveBeenCalledTimes(3);
  //     expect(mongooseConnectionOnSpyOn).toHaveBeenCalledWith('connected', expect.any(Function));
  //     expect(mongooseConnectionOnSpyOn).toHaveBeenCalledWith('disconnected', expect.any(Function));
  //     expect(mongooseConnectionOnSpyOn).toHaveBeenCalledWith('error', expect.any(Function));
  //   });
  // });
  // Error case test
  // it('should log an error when the connection fails', async () => {
  //   // Arrange
  //   const error = new Error('Connection error');
  //   mongooseConnectSpyOn.mockRejectedValueOnce(error);

  //   // Act
  //   await expect(mongooseConnect()).rejects.toThrow(error);

  //   // Trigger the 'error' event handler
  //   mongooseConnectionOnSpyOn.mock.calls[2]![1](error);

  //   // Assert
  // });
  describe('convertToPlainObject', () => {
    it('should return the same object if it does not have toObject method', () => {
      const object = { a: 1 };
      expect(convertToPlainObject(object)).toBe(object);
    });
    it('should return the plain object if it has toObject method', () => {
      const object = { a: 1, toObject: () => ({ a: 1 }) };
      expect(convertToPlainObject(object)).toEqual({ a: 1 });
    });
  });
  describe('databasePing', () => {
    it('should return the time taken to ping the database', async () => {
      const mockTime: [number, number] = [1, 500_000_000]; // 1.5 seconds in hrtime format
      jest.spyOn(process, 'hrtime').mockReturnValueOnce([0, 0]).mockReturnValueOnce(mockTime);

      const time = await databasePing();

      expect(time).toBe(1500); // Time should be in milliseconds
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mongoose.connection.db?.command).toHaveBeenCalledWith({ ping: 1 });
    });
  });
});
