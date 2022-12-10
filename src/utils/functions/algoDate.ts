import dayjs from 'dayjs';

export function moreThanTwentyFourHoursAgo(date: number): boolean {
    return dayjs().diff(dayjs(date), 'hour') >= 24;
}
