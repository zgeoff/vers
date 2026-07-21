/**
 * xstate's `setup()` consumes its `types` property at the type level only — the runtime value is
 * never read — and every property of the shape it accepts is optional, so an empty object is
 * assignable to `Partial<T>` for any machine's context/events/input shape. Inference through the
 * optional properties names the shapes with no assertion anywhere.
 */
export function buildMachineTypes<T>(): Partial<T> {
  return {};
}
