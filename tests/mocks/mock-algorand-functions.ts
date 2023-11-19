import { faker } from '@faker-js/faker';
import { SuggestedParamsWithMinFee } from 'algosdk/dist/types/types/transactions/base.js';

export const mockAlgorand = {
  getCreatedAssets: jest.fn().mockReturnValue([]),
  updateAssetMetadata: jest.fn().mockReturnValue(0),
  generateWalletAccount: jest.fn().mockImplementation(() => faker.string.alpha(20)),
  getAllStdAssets: jest.fn().mockReturnValue([]),
  getTokenOptInStatus: jest.fn().mockReturnValue({ optedIn: false, tokens: 10 }),
  lookupAssetsOwnedByAccount: jest.fn().mockReturnValue([]),
  getBulkAssetArc69Metadata: jest.fn().mockReturnValue([]),
};
//* Use the below code to mock the Algorand class
// jest.mock('../../services/Algorand', () => ({
//     Algorand: jest.fn().mockImplementation(() => mockAlgorand),
// }));
//* Use the Above code to mock the Algorand class
export const transactionParameters: SuggestedParamsWithMinFee = {
  fee: 0,
  genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
  genesisID: 'mainnet-v1.0',
  flatFee: false,
  lastRound: 33_036_753,
  firstRound: 33_035_753,
  minFee: 1000,
};

export const arc69Example = {
  standard: 'arc69',
  description: faker.commerce.productName(),
  mime_type: 'image/png',
  properties: {
    'Accessory (Back)': `${faker.commerce.productAdjective()} - ${faker.commerce.product()}`,
    'Accessory (Head)': `${faker.commerce.productAdjective()} - ${faker.commerce.product()}`,
    'Background (BG)': `${faker.commerce.productAdjective()} - ${faker.commerce.product()}`,
    'Body Design': `${faker.commerce.productAdjective()} - ${faker.commerce.productMaterial()}`,
    'Eye Accessories': `${faker.commerce.productAdjective()} - ${faker.commerce.product()}`,
    'Face Color': `${faker.commerce.productAdjective()} - ${faker.color.human()}`,
  },
};
