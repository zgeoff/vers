import type { AnyContractRouter } from '@orpc/contract';
import { getContractRouter, isContractProcedure } from '@orpc/contract';

export function makeIsRetryable(
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
