import type { IPropertyResolutionEngine } from '../IPropertyResolutionEngine.js';
import fs from 'node:fs';

import { validString } from '../../../../utils/Utils.js';
import { PostConstruct } from '../../decorators/PostConstruct.js';
import { PropertyType } from '../IPropertyResolutionEngine.js';

export class PackageJsonResolutionEngine implements IPropertyResolutionEngine {
    private readonly packageLocation: string = process.env.npm_package_json;
    private packageJson: Record<string, any>;

    public getProperty(prop: string): PropertyType {
        return this.packageJson?.[prop];
    }

    @PostConstruct
    private init(): void {
        if (!validString(this.packageLocation)) {
            return;
        }
        const fileByteArray = fs.readFileSync(this.packageLocation, 'utf8');
        this.packageJson = JSON.parse(fileByteArray);
    }
}
