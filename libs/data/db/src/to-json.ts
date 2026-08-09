import type { Json } from './types';

/**
 * Converts a schema-validated structure into the `Json` value a jsonb column write accepts — the
 * one place that conversion is allowed to assert.
 *
 * The assertion exists because zod object types carry an `unknown`-typed index signature that
 * TypeScript cannot prove assignable to the recursive `Json` shape, even though the runtime value
 * is plain data. Callers must pass a plain object whose every field is JSON-serializable — a
 * schema-parsed payload or a literal of primitives, arrays, and plain objects; the driver
 * serializes the value as-is, so a class instance or function anywhere inside it would corrupt the
 * stored row.
 */
export function toJSON(value: Readonly<Record<string, unknown>>): Json {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the sole sanctioned jsonb-write conversion; see the doc comment above
  return value as Json;
}
