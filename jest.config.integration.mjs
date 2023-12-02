// jest.integration.config.mjs
import baseConfig from './jest.config.mjs';

export default {
  ...baseConfig,
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/tests/integration/',
  ],
};
