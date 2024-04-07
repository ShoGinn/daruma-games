import { APIEmbedField } from 'discord.js';

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';

import { randomUtils } from './random-utils.js';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ObjectUtil {
  static {
    dayjs.extend(relativeTime);
    dayjs.extend(duration);
    dayjs.extend(utc);
  }
  public static ellipseAddress(
    address: string | null = '',
    start: number = 5,
    end: number = 5,
  ): string {
    if (!address) {
      return '';
    }
    if (address.length <= start + end) {
      return address;
    }
    start = Math.min(start, address.length);
    end = Math.min(end, address.length - start);
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }

  public static singleFieldBuilder(
    name: string,
    value: string,
    inline: boolean = false,
  ): [APIEmbedField] {
    return [
      {
        name,
        value,
        inline,
      },
    ];
  }
  public static onlyDigits(string: string): string {
    return string.replaceAll(/\D/g, '');
  }

  public static delayFor(ms: number): Promise<void> {
    return new Promise((result) => setTimeout(result, ms));
  }
  public static randomDelayFor = async (
    minDelay: number,
    maxDelay: number,
    delayFunction: (ms: number) => Promise<void> = ObjectUtil.delayFor.bind(ObjectUtil),
  ): Promise<void> => {
    const delay = randomUtils.random.integer(Math.min(minDelay, maxDelay), maxDelay);
    await delayFunction(delay);
  };

  /**
   * Converts a bigint or number to a number with the specified number of decimal places.
   *
   * @param {bigint|number} integer - The number to convert. If a `bigint` is passed, it will be divided by 10^`decimals`.
   * @param {number} decimals - The number of decimal places for the result. If `decimals` is 0, the integer will not be divided.
   * @returns {number} - The converted number.
   */

  public static convertBigIntToNumber(integer: bigint | number, decimals: number): number {
    if (typeof integer === 'number') {
      return integer;
    }
    if (typeof integer === 'bigint') {
      if (decimals === 0 || integer === BigInt(0)) {
        return Number.parseInt(integer.toString());
      }
      const singleUnit = BigInt(`1${'0'.repeat(decimals)}`);
      const wholeUnits = integer / singleUnit;

      return Number.parseInt(wholeUnits.toString());
    }
    throw new Error('Invalid type passed to convertBigIntToNumber');
  }

  public static timeAgo(date: dayjs.ConfigType): string {
    return dayjs(date).fromNow();
  }
  public static moreThanTwentyFourHoursAgo(date: dayjs.ConfigType): boolean {
    return dayjs().diff(dayjs(date), 'hour') >= 24;
  }
  public static timeFromNow(durationInMilliseconds: dayjs.ConfigType): string {
    return dayjs(durationInMilliseconds).fromNow();
  }
  public static timeToHuman(durationInMilliseconds: number): string {
    return dayjs.duration(durationInMilliseconds).humanize();
  }
  public static parseUTCDate(dateString: string): dayjs.Dayjs {
    // Check if dateString contains a time
    if (!dateString.includes('T') && !dateString.includes(' ')) {
      // Append a time of 00:00:00Z if it doesn't
      dateString += 'T00:00:00Z';
    }

    const date = dayjs(dateString).utc(); // Check if the date is valid
    if (!date.isValid() || typeof dateString !== 'string') {
      throw new Error(
        `Invalid date format. ISO 8601 is required\n\n
        Server Timezone converted to UTC is used for the date\n
        Examples:\n
        ${dayjs().toISOString()}
        ${dayjs().format('YYYY-MM-DD HH:MM[Z]')}
        \n\n A space is allowed between the date and time instead of the T`,
      );
    }
    return date;
  }
  public static zuluUTCDateYesterday(): dayjs.Dayjs {
    return dayjs().subtract(1, 'day').utc().startOf('day');
  }
}
