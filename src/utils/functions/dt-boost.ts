import { getData, setData } from '../../entities/data.mongo.js';

export async function getTemporaryPayoutModifier(): Promise<number | undefined> {
  const karmaBoostStart = await getData('karmaBoostStart');
  const karmaBoostExpiry = await getData('karmaBoostExpiry');
  const karmaBoostModifier = await getData('karmaBoostModifier');
  const timeNow = new Date(Date.now());
  if (
    karmaBoostStart &&
    karmaBoostExpiry &&
    karmaBoostStart < timeNow &&
    karmaBoostExpiry > timeNow
  ) {
    return karmaBoostModifier;
  }
  return;
}

export async function setTemporaryPayoutModifier(
  modifier: number,
  start: Date,
  expiry: Date,
): Promise<void> {
  await setData('karmaBoostModifier', modifier);
  await setData('karmaBoostStart', start);
  await setData('karmaBoostExpiry', expiry);
  return;
}
