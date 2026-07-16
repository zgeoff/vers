/**
 * Recursively marks every property readonly, leaving function shapes untouched. Client return
 * types are zod-inferred and mutable; wrapping them makes cached RPC data immutable at the type
 * level without waiving the readonly-parameter lint rule at every call site.
 */
export type DeepReadonly<T> = T extends (...args: ReadonlyArray<never>) => unknown
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };
