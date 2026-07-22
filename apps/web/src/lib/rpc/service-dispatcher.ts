import { Agent } from 'undici';

/**
 * The undici dispatcher every outbound call to a `<service>.flycast` origin sends through. A Fly
 * machine autosuspends on a horizon far shorter than undici's own multi-minute idle default, so a
 * pooled socket left open past that horizon still looks usable while the machine underneath it is
 * gone — a request written onto it neither arrives nor triggers the machine's wake.
 * `keepAliveMaxTimeout` is the field that matters: it caps whatever `Keep-Alive` hint the origin
 * advertises, and `keepAliveTimeout` matches it as the default absent a hint. `connectTimeout`
 * mirrors the shortest per-attempt timeout an outbound call is bounded to, so a stalled handshake
 * fails within that attempt's own budget instead of consuming it.
 */
export const serviceDispatcher = new Agent({
  connectTimeout: 2000,
  keepAliveMaxTimeout: 30_000,
  keepAliveTimeout: 30_000,
});

/**
 * The DOM lib's `RequestInit` carries no `dispatcher` field, though undici's global `fetch` honors
 * one anyway. Typing a call's init through this alias before passing it to `fetch` attaches
 * `serviceDispatcher` without an excess-property error or a cast.
 */
export type ServiceFetchInit = RequestInit & { readonly dispatcher?: Agent };
