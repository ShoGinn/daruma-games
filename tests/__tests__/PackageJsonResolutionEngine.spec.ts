import fs from 'node:fs';
import { container } from 'tsyringe';

import { PackageJsonResolutionEngine } from '../../src/model/framework/engine/impl/PackageJsonResolutionEngine.js';

describe('PackageJsonResolutionEngine', () => {
    let packageJsonResolutionEngine: PackageJsonResolutionEngine;
    describe('init', () => {
        it('should throw an error when packageLocation is not a string', () => {
            process.env.npm_package_json = 'undefined';
            expect(() => {
                packageJsonResolutionEngine = container.resolve(PackageJsonResolutionEngine);
            }).toThrowError('Unable to read package.json from undefined');
        });

        it('should set packageJson when packageLocation is a string', () => {
            const expectedPackageJson = { name: 'my-package', version: '1.0.0' };
            const readFileSyncMock = jest
                .spyOn(fs, 'readFileSync')
                .mockReturnValue(JSON.stringify(expectedPackageJson));
            process.env.npm_package_json = 'package.json';

            packageJsonResolutionEngine = container.resolve(PackageJsonResolutionEngine);

            expect(readFileSyncMock).toHaveBeenCalledWith('package.json', 'utf8');
            expect(packageJsonResolutionEngine['packageJson']).toEqual(expectedPackageJson);
            delete process.env.npm_package_json;
        });
    });
});
