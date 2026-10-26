import type { DisposableResourceScope } from './types';

type Disposer = () => Promise<void> | void;

export function createResourceScope(): DisposableResourceScope {
  const disposers: Array<Disposer> = [];

  return {
    adopt: (value, dispose) => {
      disposers.push(() => dispose(value));

      return value;
    },
    dispose: async () => {
      const failures: Array<unknown> = [];

      for (const dispose of disposers.splice(0).toReversed()) {
        try {
          await dispose();
        } catch (error) {
          failures.push(error);
        }
      }

      if (failures.length > 0) {
        throw new AggregateError(failures, `${failures.length} service resource(s) failed to stop`);
      }
    },
  };
}
