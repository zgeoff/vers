// xstate's `setup()` reads its `types` property at the type level only, and every property of
// that shape is optional, so an empty object satisfies `Partial<T>` for any machine's shapes
export function buildMachineTypes<T>(): Partial<T> {
  return {};
}
