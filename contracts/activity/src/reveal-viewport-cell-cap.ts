/**
 * Cap on a `getRevealedNodes` viewport's cell area (`(maxCX - minCX + 1) * (maxCY - minCY + 1)`).
 * The reveal disc union, not the viewport, decides what may disclose; this cap only bounds how much
 * of that union one request can read back, keeping a single query's derivation work — one
 * `deriveWorldmapContent` call per returned cell — flat regardless of caller-chosen viewport size.
 */
export const REVEAL_VIEWPORT_CELL_CAP = 4096;
