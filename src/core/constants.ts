export type ConstantRange = { MIN: number; MAX: number };

export const karmaAutoClaimAmounts = {
  daily: 500,
  monthly: 50,
};

export const lowTokenAmounts = {
  karmaAsset: 200_000,
  karmaAssetReplenishAmount: 100_000,
  enlightenmentAsset: 100,
};

export const karmaShop = {
  necessaryArtifacts: 4,
  artifactCost: 2500,
};

const itemElixirBase = 15;

export const karmaVendor = {
  uptoFiveCoolDown: itemElixirBase * 5,
  uptoTenCoolDown: itemElixirBase * 10,
  uptoFifteenCoolDown: itemElixirBase * 15,
};

export const setupButtonFunctionNames = {
  creatorWallet: 'creatorWalletButton',
  reservedWallet: 'reservedWalletButton',
  addStd: 'addStd',
};
export const defaultAssetExplorerConfig = {
  baseUrl: 'https://allo.info',
  pathFormat: '/asset/{assetId}/nft',
};
export const defaultTransactionExplorerConfig = {
  baseUrl: 'https://allo.info',
  pathFormat: '/tx/{txnId}',
};
