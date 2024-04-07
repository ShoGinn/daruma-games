/* istanbul ignore file */
import { Client } from 'discordx';

import { container, InjectionToken } from 'tsyringe';

/**
 * Spring-like post construction executor, this will fire after a dependency is resolved and constructed
 *
 * @template T
 * @param {T} target
 * @param {string} _propertyKey
 * @param {PropertyDescriptor} descriptor
 */
export function PostConstruct<T>(
  target: T,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
): void {
  container.afterResolution(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    target?.constructor as InjectionToken<T>,
    (_t, result: T | T[]): void => {
      let client: Client | undefined;
      if (container.isRegistered(Client)) {
        client = container.resolve(Client);
      }
      descriptor.value.call(result, client);
    },
    {
      frequency: 'Once',
    },
  );
}
