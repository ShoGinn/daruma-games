import { faker } from '@faker-js/faker';
import { generateAccount, secretKeyToMnemonic } from 'algosdk';

import { DiscordId } from '../../src/types/core.js';

export function generateDiscordId(): DiscordId {
  return faker.number
    .int({
      min: 100_000_000_000_000_000,
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      max: 999_999_999_999_999_999,
    })
    .toString() as DiscordId;
}
export const generateFakeWebhookUrl = (): string => {
  const id = faker.string.numeric({ length: 18 });
  const token = faker.string.alphanumeric({ length: 68 });
  return `https://discord.com/api/webhooks/${id}/${token}`;
};

export function generateAlgoWalletAddress(): string {
  return generateAccount().addr;
}
export function generateMnemonic(): string {
  const { sk } = generateAccount();
  return secretKeyToMnemonic(sk);
}
