const config = {
  endOfLine: 'lf',
  quoteProps: 'as-needed',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  printWidth: 100,
  trailingComma: 'all',
  useTabs: false,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    'dotenv/config',
    '^node:(.*)$',
    '^@?discord[.]?js',
    '^@?discordx',
    '<THIRD_PARTY_MODULES>',
    '^@/',
    '^[.][.]',
    '^[.]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderCaseInsensitive: true,
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
  overrides: [
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        useTabs: false,
      },
    },
    {
      files: '*.json',
      options: {
        parser: 'json',
        trailingComma: 'none',
      },
    },
  ],
};
module.exports = config;
