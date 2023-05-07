import { SnowflakeUtil } from 'discord.js';

import {
    getRandomTime,
    isSnowflakeLarger,
    isSnowflakeLargerAsInt,
    randomSnowflake,
    randomSnowflakeLargerThan,
} from '../../../src/utils/functions/snowflake.js';
describe('Snowflake', () => {
    it('should correctly tell if a snowflake is smaller', () => {
        expect(isSnowflakeLarger('1', '2')).toBeFalsy();
    });
    it('should correctly tell if a snowflake is larger', () => {
        expect(isSnowflakeLarger('2', '1')).toBeTruthy();
    });
    it('should correctly tell if a snowflake is equal', () => {
        expect(isSnowflakeLarger('1', '1')).toBeFalsy();
    });
});

describe('getRandomTime', () => {
    it('should return a random date between start and end dates', () => {
        const start = new Date(2022, 0, 1);
        const end = new Date(2022, 11, 31);

        const result = getRandomTime(start, end);

        expect(result.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(result.getTime()).toBeLessThanOrEqual(end.getTime());
    });

    it('should return a random date between 2015-01-01 and the current date if no start and end dates are provided', () => {
        const result = getRandomTime();

        const startDate = new Date(2015, 0, 1);
        const endDate = new Date();

        expect(result.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(result.getTime()).toBeLessThanOrEqual(endDate.getTime());
    });
});
describe('randomSnowflake', () => {
    it('should return a random snowflake between start and end dates', () => {
        const start = new Date(2022, 0, 1);
        const end = new Date(2022, 11, 31);

        const result = randomSnowflake(start, end);

        expect(SnowflakeUtil.deconstruct(result).timestamp).toBeGreaterThanOrEqual(start.getTime());
        expect(SnowflakeUtil.deconstruct(result).timestamp).toBeLessThanOrEqual(end.getTime());
    });

    it('should return a random snowflake between January 1, 2015, and the current date if no start and end dates are provided', () => {
        const result = randomSnowflake();

        const startDate = new Date(2015, 0, 1);
        const endDate = new Date();

        expect(SnowflakeUtil.deconstruct(result).timestamp).toBeGreaterThanOrEqual(
            startDate.getTime()
        );
        expect(SnowflakeUtil.deconstruct(result).timestamp).toBeLessThanOrEqual(endDate.getTime());
    });
});

describe('randomSnowflakeLargerThan', () => {
    it('should return a random snowflake larger than the given snowflake', () => {
        const startSnowflake = SnowflakeUtil.generate();
        const result = randomSnowflakeLargerThan(startSnowflake);

        expect(result).toBeGreaterThan(startSnowflake);
    });
});

describe('isSnowflakeLargerAsInt', () => {
    it('should return -1 if a is smaller than b', () => {
        const a = SnowflakeUtil.generate();
        const b = SnowflakeUtil.generate({ timestamp: SnowflakeUtil.timestampFrom(a) + 1000 });
        const result = isSnowflakeLargerAsInt(a, b);

        expect(result).toBe(-1);
    });

    it('should return -1 if a is equal to b', () => {
        const a = SnowflakeUtil.generate();
        const result = isSnowflakeLargerAsInt(a, a);

        expect(result).toBe(-1);
    });

    it('should return 1 if a is larger than b', () => {
        const a = SnowflakeUtil.generate({ timestamp: Date.now() - 1000 });
        const b = SnowflakeUtil.generate({ timestamp: SnowflakeUtil.timestampFrom(a) - 1000 });
        const result = isSnowflakeLargerAsInt(a, b);

        expect(result).toBe(1);
    });
});
