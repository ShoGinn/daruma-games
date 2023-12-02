import Handlebars from 'handlebars';

export const stdAssetTemplate = {
  AssetIndexExists: Handlebars.compile(`Asset with index: {{assetIndex}} already exists`),
  AssetIndexNotFound: Handlebars.compile(`Asset with index: {{assetIndex}} not found`),
  AssetUnitNameExists: Handlebars.compile(`Asset with unit name: {{unitName}} already exists`),
  AssetUnitNameNotFound: Handlebars.compile(`Asset with unit name: {{unitName}} not found`),
};
