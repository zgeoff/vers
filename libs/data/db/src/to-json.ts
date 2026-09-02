import type { Json } from './types';

// zod object types carry an unknown-typed index signature that TypeScript cannot prove assignable
// to the recursive Json shape, so this is the one sanctioned assertion for a jsonb write
export function toJSON(value: Readonly<Record<string, unknown>>): Json {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the sole sanctioned jsonb-write conversion; see the comment above
  return value as Json;
}
