import { faker } from '@faker-js/faker';

import { NFDSuccessResponse } from '../../src/manager/nf-domains.js';
import { generateAlgoWalletAddress } from '../setup/test-funcs.js';

export function generateRandomNFDName(): string {
  const domainName = faker.internet.domainWord();
  const suffix = '.algo';
  return domainName + suffix;
}

export function createNFDWalletRecords(
  wallet: string,
  nfdName?: string,
  discordID?: string,
): NFDSuccessResponse {
  if (!nfdName) {
    nfdName = generateRandomNFDName();
  }
  const expectedWalletRecords: NFDSuccessResponse = {
    [wallet]: [
      {
        appID: Number(faker.string.numeric(9)),
        asaID: Number(faker.string.numeric(9)),
        timeCreated: new Date().toString(),
        timeChanged: new Date().toString(),
        timePurchased: new Date().toString(),
        currentAsOfBlock: Number(faker.string.numeric(8)),
        depositAccount: wallet,
        nfdAccount: generateAlgoWalletAddress(),
        name: nfdName,
        owner: wallet,
        seller: wallet,
        metaTags: ['10+_letters', 'pristine'],
        properties: {
          internal: {
            asaid: faker.string.numeric(9),
            category: 'common',
            commission1: '50',
            commission1Agent: generateAlgoWalletAddress(),
            contractLocked: '0',
            highestSoldAmt: '46500000',
            name: nfdName,
            owner: wallet,
            saleType: 'buyItNow',
            seller: wallet,
            timeChanged: new Date().toString(),
            timeCreated: new Date().toString(),
            timePurchased: new Date().toString(),
            ver: '1.08',
          },
          userDefined: {
            avatar: 'https://images.nf.domains/avatar/' + faker.string.uuid(),
            banner: 'https://images.nf.domains/banner/' + faker.string.uuid(),
            bio: faker.lorem.paragraph(),
            domain: faker.internet.domainName(),
            name: faker.person.firstName(),
            url: 'https://app.nf.domains/name/' + nfdName + '?view=gallery',
            website: faker.internet.url(),
          },
          verified: {
            caAlgo: wallet,
            email: faker.internet.email(),
            twitter: '@' + faker.internet.userName(),
          },
        },
        caAlgo: [wallet],
        unverifiedCaAlgo: [generateAlgoWalletAddress(), generateAlgoWalletAddress()],
      },
    ],
  };
  if (
    discordID &&
    expectedWalletRecords[wallet] &&
    expectedWalletRecords[wallet][0].properties?.verified
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expectedWalletRecords[wallet][0].properties.verified['discord'] = discordID;
  }
  return expectedWalletRecords;
}

export const mockNoNFDWalletData = { status: { response: 404 }, data: '' };
