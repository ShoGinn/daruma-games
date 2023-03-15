import type { IPropertyResolutionEngine } from '../../engine/IPropertyResolutionEngine.js';
import { injectAll, registry, singleton } from 'tsyringe';

import { Beans } from '../../DI/Beans.js';
import { getInstanceCashingSingletonFactory } from '../../DI/moduleRegistrar.js';
import { EnvironmentPropertyResolutionEngine } from '../../engine/impl/EnvironmentPropertyResolutionEngine.js';
import { PackageJsonResolutionEngine } from '../../engine/impl/PackageJsonResolutionEngine.js';
import { AbstractFactory } from '../AbstractFactory.js';

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
