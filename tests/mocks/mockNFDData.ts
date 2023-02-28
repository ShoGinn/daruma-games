import { faker } from '@faker-js/faker';

import { NFDRecord } from '../../src/model/types/NFDomain.js';
import { generateAlgoWalletAddress } from '../utils/testFuncs.js';

export function generateRandomNFDName(): string {
    const domainName = faker.internet.domainWord();
    const suffix = '.algo';
    return domainName + suffix;
}

export function createNFDDiscordRecords(wallet: string, nfdName: string): NFDRecord[] {
    const expectedDiscordRecords: Array<NFDRecord> = [
        {
            appID: Number(faker.random.numeric(9)),
            asaID: Number(faker.random.numeric(9)),
            depositAccount: wallet,
            nfdAccount: generateAlgoWalletAddress(),
            name: nfdName,
            owner: wallet,
            metaTags: ['10+_letters', 'pristine'],
            properties: {
                userDefined: {
                    avatar: 'https://images.nf.domains/avatar/' + faker.datatype.uuid(),
                    url: 'https://app.nf.domains/name/' + nfdName + '?view=gallery',
                },
            },
            caAlgo: [wallet],
            unverifiedCaAlgo: [generateAlgoWalletAddress(), generateAlgoWalletAddress()],
        },
    ];
    return expectedDiscordRecords;
}
export function createNFDWalletRecords(
    wallet: string,
    nfdName?: string,
    discordID?: string
): NFDRecord[] {
    if (!nfdName) nfdName = generateRandomNFDName();
    const expectedWalletRecords: Array<NFDRecord> = [
        {
            appID: Number(faker.random.numeric(9)),
            asaID: Number(faker.random.numeric(9)),
            timeCreated: new Date(),
            timeChanged: new Date(),
            timePurchased: new Date(),
            currentAsOfBlock: Number(faker.random.numeric(8)),
            depositAccount: wallet,
            nfdAccount: generateAlgoWalletAddress(),
            name: nfdName,
            owner: wallet,
            seller: wallet,
            metaTags: ['10+_letters', 'pristine'],
            properties: {
                internal: {
                    asaid: faker.random.numeric(9),
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
                    avatar: 'https://images.nf.domains/avatar/' + faker.datatype.uuid(),
                    banner: 'https://images.nf.domains/banner/' + faker.datatype.uuid(),
                    bio: faker.lorem.paragraph(),
                    domain: faker.internet.domainName(),
                    name: faker.name.firstName(),
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
    ];
    if (
        discordID &&
        expectedWalletRecords.length > 0 &&
        expectedWalletRecords[0].properties?.verified
    ) {
        expectedWalletRecords[0].properties.verified.discord = discordID;
    }
    return expectedWalletRecords;
}
