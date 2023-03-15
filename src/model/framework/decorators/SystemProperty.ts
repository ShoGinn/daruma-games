import type { packageJsonTypes } from '../../types/generic.js';
import { container } from 'tsyringe';

import { PropertyType } from '../engine/IPropertyResolutionEngine.js';
import { PropertyResolutionManager } from '../manager/PropertyResolutionManager.js';

type propTypes = NodeJS.ProcessEnv & packageJsonTypes;

const manager = container.resolve(PropertyResolutionManager);
const propertyCache: Map<keyof propTypes, PropertyType> = new Map();
/**
 * Get a property from the system. The location where the property is loaded from is agnostic and defined by the registered IPropertyResolutionEngine classes.
 * This acts the similar to Spring's Value annotation
 *
 * @param {keyof propTypes} property
 * @param {boolean} [required=true]
 * @returns {*}  {PropertyDecorator}
 */
export function SystemProperty(
    property: keyof propTypes,
    required: boolean = true
): PropertyDecorator {
    return (target, key): void => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const original = target[key];
        Reflect.deleteProperty(target, key);
        Reflect.defineProperty(target, key, {
            enumerable: true,
            get: () => {
                if (propertyCache.has(property)) {
                    return propertyCache.get(property);
                }
                let propertyValue = manager.getProperty(property);
                if (required && propertyValue === null) {
                    throw new Error(`Unable to find prop with key "${property}"`);
                }
                /* istanbul ignore next */
                if (
                    !required &&
                    propertyValue === null &&
                    original !== null &&
                    original !== undefined
                ) {
                    // if not required and a default value is set
                    propertyValue = original;
                }
                propertyCache.set(property, propertyValue);
                return propertyValue;
            },
        });
    };
}

/**
 * Clear the property cache. This is useful for testing purposes.
 *

 */
export function clearSystemPropertyCache(): void {
    propertyCache.clear();
}
