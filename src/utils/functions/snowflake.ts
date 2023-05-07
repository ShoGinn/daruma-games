import { type Snowflake, SnowflakeUtil } from 'discord.js';

export function getRandomTime(start?: Date, end?: Date): Date {
    if (!start) {
        start = new Date(2015, 0, 1);
    }
    if (!end) {
        end = new Date();
    }
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export function randomSnowflake(start?: Date, end?: Date): bigint {
    return SnowflakeUtil.generate({ timestamp: getRandomTime(start, end) });
}

export function randomSnowflakeLargerThan(start: Snowflake | bigint): bigint {
    return SnowflakeUtil.generate({
        timestamp: new Date(SnowflakeUtil.timestampFrom(start) + 1000),
    });
}

export function isSnowflakeLargerAsInt(a: Snowflake | bigint, b: Snowflake | bigint): 0 | 1 | -1 {
    return isSnowflakeLarger(a, b) ? (isSnowflakeLarger(a, b) ? 1 : 0) : -1;
}

export function isSnowflakeLarger(a: Snowflake | bigint, b: Snowflake | bigint): boolean {
    const aAsBigInt = BigInt(a);
    const bAsBigInt = BigInt(b);
    return aAsBigInt > bAsBigInt;
}
