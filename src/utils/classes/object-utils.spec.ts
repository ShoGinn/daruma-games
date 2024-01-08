import dayjs from 'dayjs';

import { ObjectUtil } from './object-utils.js';

describe('Object Utils', () => {
  describe('ellipseAddress', () => {
    test('should return the address if it is less than 10 characters', () => {
      const address = 'address';
      expect(ObjectUtil.ellipseAddress(address)).toBe(address);
    });

    test('should return an ellipses address if it is greater than 10 characters', () => {
      const address = '12345678910';
      expect(ObjectUtil.ellipseAddress(address)).toBe('12345...78910');
    });

    test('should return an ellipses address if it is less than 10 characters', () => {
      const address = 'address';
      expect(ObjectUtil.ellipseAddress(address, 2, 2)).toBe('ad...ss');
    });
    test('should not error out if null string', () => {
      const address = '';
      expect(ObjectUtil.ellipseAddress(address)).toBe('');
    });
    test('should not error out if nothing is given', () => {
      expect(ObjectUtil.ellipseAddress()).toBe('');
    });
  });
  describe('onlyDigits', () => {
    test('should return the string with only digits', () => {
      const string_ = '1234567890';
      expect(ObjectUtil.onlyDigits(string_)).toBe(string_);
    });
    test('should return the string with only digits even though it has letters in it', () => {
      const string_ = '1234567890abcdefg';
      expect(ObjectUtil.onlyDigits(string_)).toBe('1234567890');
    });
  });

  describe('Time Utils', () => {
    describe('timeAgo', () => {
      test('should return the time ago from the given date', () => {
        const date = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const timeAgo = ObjectUtil.timeAgo(date);
        expect(timeAgo).toBe('an hour ago');
      });
    });

    describe('moreThanTwentyFourHoursAgo', () => {
      test('should return true if date is more than 24 hours ago', () => {
        const date = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
        const result = ObjectUtil.moreThanTwentyFourHoursAgo(date);
        expect(result).toBe(true);
      });

      test('should return false if date is less than 24 hours ago', () => {
        const date = Date.now() - 23 * 60 * 60 * 1000; // 23 hours ago
        const result = ObjectUtil.moreThanTwentyFourHoursAgo(date);
        expect(result).toBe(false);
      });
    });

    describe('timeFromNow', () => {
      test('should return the time from now for the given milliseconds', () => {
        const date = Date.now() + 60 * 60 * 1000; // 1 hour
        const timeFromNow = ObjectUtil.timeFromNow(date);
        expect(timeFromNow).toBe('in an hour');
      });
    });

    describe('timeToHuman', () => {
      test('should return the human-readable duration for the given milliseconds', () => {
        const durationInMilliseconds = 60 * 1000; // 1 minute
        const humanDuration = ObjectUtil.timeToHuman(durationInMilliseconds);
        expect(humanDuration).toBe('a minute');
      });
    });
    describe('parseDate', () => {
      it('should return a valid dayjs object for a valid ISO 8601 date string', () => {
        const date = dayjs().toISOString();
        const result = ObjectUtil.parseUTCDate(date);
        expect(result.isValid()).toBe(true);
        expect(result.toISOString()).toBe(date);
      });

      it('should throw an error for an invalid date string', () => {
        const date = 'invalid date';
        expect(() => ObjectUtil.parseUTCDate(date)).toThrow();
      });
      it('should work for a simple date string', () => {
        const date = '2021-01-01';
        const result = ObjectUtil.parseUTCDate(date);
        expect(result.isValid()).toBe(true);
        expect(result.toISOString()).toBe('2021-01-01T00:00:00.000Z');
      });
      it('should throw an error for a non-string input', () => {
        const date = 123_456;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => ObjectUtil.parseUTCDate(date as any)).toThrow();
      });
    });
    describe('zuluUTCDateYesterday', () => {
      it('should return a date object representing yesterday in UTC', () => {
        const result = ObjectUtil.zuluUTCDateYesterday();
        const now = dayjs().utc();

        expect(result.year()).toEqual(now.subtract(1, 'day').year());
        expect(result.month()).toEqual(now.subtract(1, 'day').month());
        expect(result.date()).toEqual(now.subtract(1, 'day').date());
      });

      it('should return a date object at the start of the day', () => {
        const result = ObjectUtil.zuluUTCDateYesterday();

        expect(result.hour()).toBe(0);
        expect(result.minute()).toBe(0);
        expect(result.second()).toBe(0);
      });

      it('should return a date object in UTC', () => {
        const result = ObjectUtil.zuluUTCDateYesterday();

        expect(result.isUTC()).toBeTruthy();
      });
    });
  });
  describe('singleFieldBuilder', () => {
    test('should return an array with a single APIEmbedField object with inline', () => {
      const name = 'Test name';
      const value = 'Test value';
      const inline = true;
      const result = ObjectUtil.singleFieldBuilder(name, value, inline);
      expect(result).toEqual([{ name, value, inline }]);
    });
    test('should return an array with a single APIEmbedField object without inline', () => {
      const name = 'Test name';
      const value = 'Test value';
      const result = ObjectUtil.singleFieldBuilder(name, value);
      expect(result).toEqual([{ name, value, inline: false }]);
    });
  });
  describe('delayFor', () => {
    test('should wait for the specified amount of time', async () => {
      // Arrange
      const ms = 1000;
      jest.useFakeTimers();

      // Act
      const startTime = Date.now();
      const delayPromise = ObjectUtil.delayFor(ms);
      jest.advanceTimersByTime(ms);
      await delayPromise;
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeGreaterThanOrEqual(ms);

      jest.useRealTimers();
    });
  });
  describe('randomDelayFor', () => {
    test('should delay for a random time within the specified range', async () => {
      const minDelay = 1000;
      const maxDelay = 2000;
      const delayFunction = jest.fn();
      await ObjectUtil.randomDelayFor(minDelay, maxDelay, delayFunction);
      expect(delayFunction).toHaveBeenCalledTimes(1);
      expect(delayFunction).toHaveBeenCalledWith(expect.any(Number));
      const actualDelay = delayFunction.mock.calls[0][0];
      expect(actualDelay).toBeGreaterThanOrEqual(minDelay);
      expect(actualDelay).toBeLessThanOrEqual(maxDelay);
    });
    test('should pick the lowest amount if min is larger than max', async () => {
      const minDelay = 2000;
      const maxDelay = 1000;
      const delayFunction = jest.fn();
      await ObjectUtil.randomDelayFor(minDelay, maxDelay, delayFunction);
      expect(delayFunction).toHaveBeenCalledTimes(1);
      expect(delayFunction).toHaveBeenCalledWith(maxDelay);
    });

    test('should work with zero min and max delays', async () => {
      const delayFunction = jest.fn();
      await ObjectUtil.randomDelayFor(0, 0, delayFunction);
      expect(delayFunction).toHaveBeenCalledTimes(1);
      expect(delayFunction).toHaveBeenCalledWith(0);
    });
    test('should work with equal min and max delays', async () => {
      const delay = 1000;
      const delayFunction = jest.fn();
      await ObjectUtil.randomDelayFor(delay, delay, delayFunction);
      expect(delayFunction).toHaveBeenCalledTimes(1);
      expect(delayFunction).toHaveBeenCalledWith(delay);
    });
    it('should call delayFor with a random delay', async () => {
      const minDelay = 1000;
      const maxDelay = 2000;

      // Mock delayFor
      const delayForMock = jest.fn().mockResolvedValue(0);
      jest.spyOn(ObjectUtil, 'delayFor').mockImplementation(delayForMock);

      await ObjectUtil.randomDelayFor(minDelay, maxDelay);

      // Check if delayFor was called
      expect(delayForMock).toHaveBeenCalled();

      // Check if delayFor was called with a delay between minDelay and maxDelay
      const delay = delayForMock.mock.calls[0][0];
      expect(delay).toBeGreaterThanOrEqual(minDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);

      // Restore the original implementation
      jest.restoreAllMocks();
    });
  });
  describe('convertBigIntToNumber', () => {
    test('should return the same number if given a number input', () => {
      expect(ObjectUtil.convertBigIntToNumber(123, 2)).toBe(123);
    });

    test('should convert a BigInt to a number with decimals', () => {
      expect(ObjectUtil.convertBigIntToNumber(BigInt(1_431_400_000_000), 8)).toBe(14_314);
    });

    test('should convert a BigInt to a whole number if decimals is zero', () => {
      expect(ObjectUtil.convertBigIntToNumber(BigInt(123_456_789), 0)).toBe(123_456_789);
    });
    test('should return 0 if given a bigint of 0', () => {
      expect(ObjectUtil.convertBigIntToNumber(BigInt(0), 2)).toBe(0);
    });
    test('should throw a TypeError if given a string', () => {
      expect.assertions(1);
      // @ts-expect-error Testing string input
      expect(() => ObjectUtil.convertBigIntToNumber('123', 2)).toThrow(Error);
    });
  });
});
