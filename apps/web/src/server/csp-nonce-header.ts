/**
 * Internal header the secure-headers middleware uses to thread the per-request CSP nonce down to
 * the router factory, which reads it via `getRequestHeader` to configure `ssr.nonce` — the only
 * channel available since the router factory runs isomorphically and can't reach into request
 * middleware context directly.
 */
export const CSP_NONCE_HEADER = 'x-vers-csp-nonce';
