export default {
  transform: {
    '<regex_match_files>': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  coveragePathIgnorePatterns: ['tests'],
  testEnvironment: 'node',
  workerIdleMemoryLimit: 0.2,
  testTimeout: 30_000,
  preset: 'ts-jest/presets/default-esm',
  resolver: 'ts-jest-resolver',
  moduleNameMapper: {
    '^(\\.{1,2}/.*/llhttp\\.wasm\\.js)$': '$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleDirectories: ['node_modules', '__mocks__'],
  transformIgnorePatterns: [],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/build/'],
  setupFiles: ['<rootDir>/tests/setup/setup.ts'],
};
