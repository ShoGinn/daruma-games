import type { IDiFactory } from './interface-di-factory.js';
import Immutable from 'immutable';

export abstract class AbstractFactory<T> implements IDiFactory<T> {
    public static readonly factories: Array<AbstractFactory<unknown>> = [];
    private readonly _engines: Immutable.Set<T>;

    protected constructor(engines: Array<T>) {
        // eslint-disable-next-line import/no-named-as-default-member
        this._engines = Immutable.Set(engines);
        AbstractFactory.factories.push(this);
    }

    public get engines(): Immutable.Set<T> {
        return this._engines;
    }
}
