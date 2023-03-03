import type { PropertyType } from '../engine/IPropertyResolutionEngine.js';
import { singleton } from 'tsyringe';

import { PropertyResolutionFactory } from '../factory/impl/PropertyResolutionFactory.js';

@singleton()
/**
 * Manager to obtain property from the PropertyResolutionFactory
 */
export class PropertyResolutionManager {
    public constructor(private _propertyResolutionFactory: PropertyResolutionFactory) {}

    /**
     * Get system property
     *
     * @param {string} prop
     * @returns {PropertyType}
     */
    public getProperty(prop: string | number): PropertyType {
        let propValue: PropertyType = null;
        for (const resolutionEngine of this._propertyResolutionFactory.engines) {
            const resolvedProp = resolutionEngine.getProperty(prop);
            if (resolvedProp !== null) {
                propValue = resolvedProp ?? null;
                break;
            }
        }
        return propValue ?? null;
    }
}
