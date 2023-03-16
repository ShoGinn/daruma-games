import type { IPropertyResolutionEngine } from '../../engine/interface-property-resolution-engine.js';
import { injectAll, registry, singleton } from 'tsyringe';

import { Beans } from '../../direct-injection/beans.js';
import { getInstanceCashingSingletonFactory } from '../../direct-injection/module-registrar.js';
import { EnvironmentPropertyResolutionEngine } from '../../engine/impl/environment-property-resolution-engine.js';
import { PackageJsonResolutionEngine } from '../../engine/impl/package-json-resolution-engine.js';
import { AbstractFactory } from '../abstract-factory.js';

@singleton()
@registry([
    {
        token: Beans.IPropertyResolutionEngine,
        useFactory: getInstanceCashingSingletonFactory(EnvironmentPropertyResolutionEngine),
    },
    {
        token: Beans.IPropertyResolutionEngine,
        useFactory: getInstanceCashingSingletonFactory(PackageJsonResolutionEngine),
    },
])
export class PropertyResolutionFactory extends AbstractFactory<IPropertyResolutionEngine> {
    public constructor(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        @injectAll(Beans.IPropertyResolutionEngine) beans: Array<IPropertyResolutionEngine>
    ) {
        super(beans);
    }
}
