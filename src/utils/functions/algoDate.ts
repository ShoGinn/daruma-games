import dayjs from 'dayjs'

export const moreThanTwentyFourHoursAgo = (date: number) => {
  return dayjs().diff(dayjs(date), 'hour') >= 24
}
