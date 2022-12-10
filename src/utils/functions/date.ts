import dayjs from 'dayjs';
import dayjsTimeZone from 'dayjs/plugin/timezone';
import dayjsUTC from 'dayjs/plugin/utc';

import { generalConfig } from '../../config/general.js';

dayjs.extend(dayjsUTC);
dayjs.extend(dayjsTimeZone);

dayjs.tz.setDefault(generalConfig.timezone);

export const datejs = dayjs.tz;

const dateMasks = {
    default: 'DD/MM/YYYY - HH:mm:ss',
    onlyDate: 'DD/MM/YYYY',
    onlyDateFileName: 'YYYY-MM-DD',
};

/**
 * Format a date object to a templated string using the [date-and-time](https://www.npmjs.com/package/date-and-time) library.
 * @param date
 * @param mask - template for the date format
 * @returns
 */
export function formatDate(date: Date, mask: keyof typeof dateMasks = 'default'): string {
    return datejs(date).format(dateMasks[mask]);
}

export function timeAgo(date: Date): string {
    return dayjs(date).fromNow();
}
