import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
    // collectCoverage: true,
    // collectCoverageFrom: ['src/**/*.ts', '!**/*.d.ts'],
    preset: 'ts-jest/presets/default-esm', // or other ESM presets
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    // also important to not have anything in here
    transformIgnorePatterns: [],
    testPathIgnorePatterns: ['/node_modules/', 'dist'],
    testRegex: '(/__tests__/).*(test|spec)\\.ts',
    transform: {
        // '^.+\\.[tj]sx?$' to process js/ts with `ts-jest`
        // '^.+\\.m?[tj]sx?$' to process js/ts/mjs/mts with `ts-jest`
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
};

export default jestConfig;
