export default {
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.eslint.json',
      },
    ],
  },
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
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/build/', '<rootDir>/testOld/'],
  setupFiles: ['<rootDir>/tests/setup/setup.ts', '<rootDir>/tests/setup/jest-mitm.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{js,jsx,ts,tsx}'],
  coveragePathIgnorePatterns: [
    '<rootDir>/.*\\.d\\.ts$',
    '<rootDir>/src/enums/.*',
    '<rootDir>/src/events/.*',
    '<rootDir>/src/guards/.*',
    '<rootDir>/src/main\\.ts$',
  ],
};
