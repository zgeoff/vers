import { Agent } from 'undici';

export const serviceDispatcher = new Agent({
  // Caps whatever `Keep-Alive` hint the origin advertises, so a pooled socket never outlives the
  // machine's autosuspend horizon.
  keepAliveMaxTimeout: 30_000,

  // Matches keepAliveMaxTimeout as the default absent a `Keep-Alive` hint.
  keepAliveTimeout: 30_000,

  // no connect timeout: a suspended machine whose resume falls back to a cold start needs seconds
  // before it accepts a connection, and a connect cap shorter than the per-attempt bound would fail
  // the call before that bound ever applied.
});
