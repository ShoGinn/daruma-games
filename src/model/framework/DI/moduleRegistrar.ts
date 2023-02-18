import { FactoryFunction, InjectionToken, instanceCachingFactory } from 'tsyringe';
import constructor from 'tsyringe/dist/typings/types/constructor.js';

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
