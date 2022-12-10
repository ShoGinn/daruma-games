import type { IPropertyResolutionEngine, PropertyType } from '../IPropertyResolutionEngine.js';

export class EnvPropertyResolutionEngine implements IPropertyResolutionEngine {
    public getProperty(prop: string): PropertyType {
        return process.env[prop] ?? null;
    }
}
