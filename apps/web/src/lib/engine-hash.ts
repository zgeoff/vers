/**
 * The sim engine hash baked into this build by the deploy CLI. Undefined in
 * dev and any build that skipped the `VITE_SIM_ENGINE_HASH` build arg — only
 * a deployed bundle carries a value.
 */
export const ENGINE_HASH: string | undefined = import.meta.env['VITE_SIM_ENGINE_HASH'];
