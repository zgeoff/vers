export interface StubHeldWriter<T> {
  readonly reached: Promise<void>;
  readonly release: () => void;
  readonly write: (value: T) => Promise<void>;
}

export function buildStubHeldWriter<T>(write: (value: T) => Promise<void>): StubHeldWriter<T> {
  const reached = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();

  return {
    reached: reached.promise,
    release: () => {
      released.resolve();
    },
    write: async (value) => {
      reached.resolve();

      await released.promise;
      await write(value);
    },
  };
}
