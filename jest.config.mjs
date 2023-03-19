export default {
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
        'src/**/*.{js,jsx,ts,tsx}',
        '!**/*.d.ts',
        '!src/model/types/**/*',
        '!src/model/framework/decorators/**/*',
        '!src/events/**/*',
        '!src/guards/**/*',
        '!src/enums/**/*',
        '!src/main.ts',
        '!src/mikro-orm.config.ts',
    ],
};