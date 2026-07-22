import type { AnyContractRouter } from '@orpc/contract';
import { getContractRouter, isContractProcedure } from '@orpc/contract';

/**
 * Builds the `path`-keyed retry predicate `makeBoundedFetch` needs from a contract router: GET and
 * HEAD procedures can't double-apply, so they're safe to retry; every other method isn't. Reading
 * the method straight off each procedure's `.route()` declaration means a new procedure is
 * correctly gated the moment its contract lands, with no hand-maintained allowlist to fall out of
 * sync.
 */
export function buildIsRetryable(
  contract: AnyContractRouter,
): (path: ReadonlyArray<string>) => boolean {
  return (path) => {
    const procedure = getContractRouter(contract, path);

    if (procedure === undefined || !isContractProcedure(procedure)) {
      return false;
    }

    const method = procedure['~orpc'].route.method;

    return method === 'GET' || method === 'HEAD';
  };
}
