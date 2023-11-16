module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json', './tests/tsconfig.json'],
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  plugins: ['import', 'jsdoc', 'simple-import-sort', '@typescript-eslint', 'deprecation', 'jest'],
  extends: [
    'plugin:unicorn/recommended',
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
    'plugin:jest/recommended',
    'plugin:jest/style',
  ],
  ignorePatterns: [
    '.eslintrc.cjs',
    'jest.config.mjs',
    'dist/',
    'node_modules/',
    '.next/',
    'out/',
    'build',
    'coverage/',
  ],
  rules: {
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-types': 'error',
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-type': 'error',
    'jsdoc/valid-types': 'error',
    'jest/expect-expect': [
      'error',
      {
        assertFunctionNames: ['expect', 'verify'],
        additionalTestBlockFunctions: [],
      },
    ],
    'jest/no-mocks-import': 'error',
    'jest/prefer-expect-resolves': 'error',
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: true,
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-inferrable-types': [
      'error',
      {
        ignoreParameters: true,
      },
    ],
    '@typescript-eslint/naming-convention': [
      'warn',
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'variable',
        types: ['function'],
        // arrow functions & react components
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      // {
      // 	"selector": "typeProperty",
      // 	"format": ["camelCase"]
      // },
      {
        selector: 'typeProperty',
        types: ['function'],
        format: ['camelCase', 'PascalCase'],
      },
    ],
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/return-await': ['error', 'always'],
    '@typescript-eslint/restrict-template-expressions': [
      'error',
      {
        allowNumber: true,
        allowBoolean: true,
        allowAny: true,
        allowNullish: true,
      },
    ],
    '@typescript-eslint/typedef': [
      'error',
      {
        parameter: true,
        propertyDeclaration: true,
      },
    ],
    'import/extensions': ['error', 'ignorePackages'],
    'import/no-extraneous-dependencies': 'error',
    'import/no-unresolved': 'off',
    'import/no-useless-path-segments': 'error',
    quotes: [
      'error',
      'single',
      {
        allowTemplateLiterals: true,
      },
    ],
    'sort-imports': [
      'error',
      {
        allowSeparatedGroups: true,
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/prefer-event-target': 'off',
    'unicorn/filename-case': ['error'],
    'unicorn/no-null': 'off',
    'no-console': 'warn',
    'deprecation/deprecation': 'warn',
  },
  overrides: [
    {
      files: ['src/types/api-generated/**'],
      rules: {
        '@typescript-eslint/naming-convention': 'off',
      },
    },
  ],
};
