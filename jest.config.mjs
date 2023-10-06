export default {
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tests/tsconfig.json',
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
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/build/'],
  setupFiles: ['<rootDir>/tests/utils/setup.ts', '<rootDir>/tests/utils/jest-mitm.ts'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/model/framework/decorators/discord-error*',
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/.*\\.d\\.ts$',
    '<rootDir>/src/enums/.*',
    '<rootDir>/src/events/.*',
    '<rootDir>/src/guards/.*',
    '<rootDir>/src/main\\.ts$',
    '<rootDir>/src/mikro-orm\\.config\\.ts$',
    '<rootDir>/src/model/framework/decorators/.*',
    '<rootDir>/src/model/types/.*',
  ],
};
