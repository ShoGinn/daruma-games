import type { IPropertyResolutionEngine } from '../IPropertyResolutionEngine.js';
import fs from 'node:fs';

import { PostConstruct } from '../../decorators/PostConstruct.js';
import { PropertyType } from '../IPropertyResolutionEngine.js';

export class PackageJsonResolutionEngine implements IPropertyResolutionEngine {
    private readonly packageLocation: string = String(process.env.npm_package_json);
    private packageJson: Record<string, any> | undefined;

    public getProperty(prop: string): PropertyType {
        return this.packageJson?.[prop];
    }

    @PostConstruct
    private init(): void {
        try {
            const fileByteArray = fs.readFileSync(this.packageLocation, 'utf8');
            this.packageJson = JSON.parse(fileByteArray);
        } catch (error) {
            throw new Error(`Unable to read package.json from ${this.packageLocation}`);
        }
    }
}
