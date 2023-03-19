import type { IPropertyResolutionEngine } from '../interface-property-resolution-engine.js';
import fs from 'node:fs';

import { PostConstruct } from '../../decorators/post-construct.js';
import { PropertyType } from '../interface-property-resolution-engine.js';

export class PackageJsonResolutionEngine implements IPropertyResolutionEngine {
    private readonly packageLocation: string = String(process.env.npm_package_json);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private packageJson: Record<string, any> | undefined;

    public getProperty(property: string): PropertyType {
        return this.packageJson?.[property];
    }

    @PostConstruct
    private init(): void {
        try {
            const fileByteArray = fs.readFileSync(this.packageLocation, 'utf8');
            this.packageJson = JSON.parse(fileByteArray);
        } catch {
            throw new Error(`Unable to read package.json from ${this.packageLocation}`);
        }
    }
}