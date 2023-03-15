import type { IPropertyResolutionEngine, PropertyType } from '../IPropertyResolutionEngine.js';

export class EnvironmentPropertyResolutionEngine implements IPropertyResolutionEngine {
    public getProperty(property: string): PropertyType {
        return process.env[property] ?? null;
    }
}
