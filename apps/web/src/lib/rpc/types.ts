import type { Agent } from 'undici';
import type { ActorOptions, AnyActorLogic } from 'xstate';

export type DeepReadonly<T> = T extends (...args: ReadonlyArray<never>) => unknown
  ? T
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };

export interface ServiceLinkContext {
  readonly actingUserID?: string | null;
}

// the DOM lib's `RequestInit` carries no `dispatcher` field, though undici's global `fetch` honors
// one; this alias attaches a dispatcher without an excess-property error or a cast
export type ServiceFetchInit = RequestInit & { readonly dispatcher?: Agent };

// the clock a bounded attempt arms its timeout on; xstate's shape, so a test steps it with
// `SimulatedClock`
export type AttemptClock = NonNullable<ActorOptions<AnyActorLogic>['clock']>;
