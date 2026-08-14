/**
 * Cap on the node count a single `revealNodes` request may carry. A reveal batch is at most a
 * viewport-sized disc of cells, so this bound sits well above any honest client's per-request total
 * while keeping a direct API caller from forcing unbounded per-request mint work in one call.
 */
export const MAX_REVEAL_BATCH_NODES = 256;
