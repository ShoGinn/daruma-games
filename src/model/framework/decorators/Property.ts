import type { packageJsonTypes } from '../../types/generic.js';
import { container } from 'tsyringe';

import { PropertyType } from '../engine/IPropertyResolutionEngine.js';
import { PropertyResolutionManager } from '../manager/PropertyResolutionManager.js';

type propTypes = NodeJS.ProcessEnv & packageJsonTypes;

const manager = container.resolve(PropertyResolutionManager);
const propCache: Map<keyof propTypes, PropertyType> = new Map();
/**
 * Get a property from the system. The location where the property is loaded from is agnostic and defined by the registered IPropertyResolutionEngine classes.
 * This acts the similar to Spring's Value annotation
 */
export function Property(prop: keyof propTypes, required: boolean = true): PropertyDecorator {
    return (target, key): void => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const original = target[key];
        Reflect.deleteProperty(target, key);
        Reflect.defineProperty(target, key, {
            enumerable: true,
            get: () => {
                if (propCache.has(prop)) {
                    return propCache.get(prop);
                }
                let propValue = manager.getProperty(prop);
                if (required && propValue === null) {
                    throw new Error(`Unable to find prop with key "${prop}"`);
                }
                if (
                    !required &&
                    propValue === null &&
                    original !== null &&
                    original !== undefined
                ) {
                    // if not required and a default value is set
                    /* istanbul ignore next */
                    propValue = original;
                }
                propCache.set(prop, propValue);
                return propValue;
            },
        });
    };
}

/**
 * Clear the property cache. This is useful for testing purposes.
 *
 * @export
 */
export function clearPropertyCache(): void {
    propCache.clear();
}
