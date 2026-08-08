/**
 * Cap on the checkpoint count a single `advanceActivity` request may carry — a single
 * continuation's own `checkpoints` tail, and the request's `continuations` array length alike.
 * The client's own offline chunker keeps a batch's total under this same bound so an honest
 * request never trips it; the server enforces it independently so a direct API caller cannot
 * force unbounded validation, hashing, and insert work in one request.
 */
export const MAX_CATCH_UP_BATCH_CHECKPOINTS = 500;
