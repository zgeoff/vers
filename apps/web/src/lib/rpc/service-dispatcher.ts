import { Agent } from 'undici';

/**
 * The undici dispatcher every outbound call to a `<service>.flycast` origin sends through. A Fly
 * machine autosuspends on a horizon far shorter than undici's own multi-minute idle default, so a
 * pooled socket left open past that horizon still looks usable while the machine underneath it is
 * gone — a request written onto it neither arrives nor triggers the machine's wake.
 */
export const serviceDispatcher = new Agent({
  // Caps whatever `Keep-Alive` hint the origin advertises, so a pooled socket never outlives the
  // machine's autosuspend horizon.
  keepAliveMaxTimeout: 30_000,

  // Matches keepAliveMaxTimeout as the default absent a `Keep-Alive` hint.
  keepAliveTimeout: 30_000,

  // No connect timeout: undici's own default sits well clear of the per-attempt bound an outbound
  // call already carries, leaving that bound the single budget a call answers to. A suspended
  // machine whose resume falls back to a cold start needs seconds before it accepts a connection,
  // and a connect cap shorter than the attempt bound would fail the call before that bound ever
  // applied.
});
