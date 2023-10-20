import { faker } from '@faker-js/faker';

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
