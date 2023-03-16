import type {
    IPropertyResolutionEngine,
    PropertyType,
} from '../interface-property-resolution-engine.js';

export class EnvironmentPropertyResolutionEngine implements IPropertyResolutionEngine {
    public getProperty(property: string): PropertyType {
        return process.env[property] ?? null;
    }
}
