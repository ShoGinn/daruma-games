import type { PropertyType } from '../engine/interface-property-resolution-engine.js';
import { singleton } from 'tsyringe';

import { PropertyResolutionFactory } from '../factory/impl/property-resolution-factory.js';

@singleton()
/**
 * Manager to obtain property from the PropertyResolutionFactory
 */
export class PropertyResolutionManager {
    public constructor(private _propertyResolutionFactory: PropertyResolutionFactory) {}

    /**
     * Get system property
     *
     * @param {string} property
     * @returns {PropertyType}
     */
    public getProperty(property: string | number): PropertyType {
        let propertyValue: PropertyType = null;
        for (const resolutionEngine of this._propertyResolutionFactory.engines) {
            const resolvedProperty = resolutionEngine.getProperty(property);
            if (resolvedProperty !== null) {
                propertyValue = resolvedProperty ?? null;
                break;
            }
        }
        return propertyValue ?? null;
    }
}
