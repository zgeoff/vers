// the router factory runs isomorphically and cannot reach request middleware context, so the
// per-request CSP nonce travels to it on this internal header
export const CSP_NONCE_HEADER = 'x-vers-csp-nonce';
