// bun abandons a hook at its default 5 s timeout, and every clone the hook has not dropped by then
// outlives the run; a checkpoint behind one drop measured 1.6 s on a 2 GiB host
export const CLONED_DATABASE_REMOVAL_TIMEOUT_MS = 60_000;
