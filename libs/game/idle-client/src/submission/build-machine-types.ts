/**
 * xstate's `setup()` consumes its `types` property at the type level only — the runtime value is
 * never read — so an empty object can stand in for any machine's context/events/input shape. This
 * owns the one assertion that requires, keeping machine definitions free of `{} as` casts.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- T exists purely so callers can name the phantom shape
export function buildMachineTypes<T>(): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- compile-time phantom; xstate never reads the value
  return {} as T;
}
