import { FactoryFunction, InjectionToken, instanceCachingFactory } from 'tsyringe';
import type { constructor } from 'tsyringe/dist/typings/types';

export function getInstanceCashingSingletonFactory<T>(
    clazz: InjectionToken<T>
): FactoryFunction<T> {
    return instanceCachingFactory<T>(c => {
        if (!c.isRegistered(clazz)) {
            c.registerSingleton(clazz as constructor<T>);
        }
        return c.resolve(clazz);
    });
}
