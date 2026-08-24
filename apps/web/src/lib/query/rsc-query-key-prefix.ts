/**
 * The first segment of the query key every RSC-backed query is cached under. An RSC composite
 * component is not a structured-clone value, so the prefix is what keeps such a query out of the
 * cross-tab broadcast.
 */
export const RSC_QUERY_KEY_PREFIX = 'rsc';
