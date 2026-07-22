import type { Agent } from 'undici';

/**
 * Recursively marks every property readonly, leaving function shapes untouched. Client return
 * types are zod-inferred and mutable; wrapping them makes cached RPC data immutable at the type
 * level without waiving the readonly-parameter lint rule at every call site.
 */
export type DeepReadonly<T> = T extends (...args: ReadonlyArray<never>) => unknown
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

/**
 * The per-call context every service client accepts: who the outbound s2s token's `sub` claim
 * names. Omitting `actingUserID` (the default) derives it from the ambient `en_session` cookie,
 * proactively re-validating a near-expired session first; an explicit user id mints for that actor
 * with no cookie read or liveness check, for a flow that already holds it with no cookie session
 * yet (login, force-logout); explicit `null` mints a verified-anonymous token with no cookie read.
 */
export interface ServiceLinkContext {
  readonly actingUserID?: string | null;
}

/**
 * The DOM lib's `RequestInit` carries no `dispatcher` field, though undici's global `fetch` honors
 * one anyway. Typing a call's init through this alias before passing it to `fetch` attaches a
 * dispatcher without an excess-property error or a cast.
 */
export type ServiceFetchInit = RequestInit & { readonly dispatcher?: Agent };
