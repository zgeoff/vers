import type { CommonORPCErrorCode } from '@orpc/client';
import type { ErrorMap } from '@orpc/contract';

type StatusedErrorMap<T extends ErrorMap> = {
  [K in keyof T]: K extends CommonORPCErrorCode
    ? T[K] & { status?: never }
    : T[K] & { status: number };
};

/**
 * Identity helper for `.errors({…})` maps that makes `status` compile-mandatory on every
 * non-canonical code — oRPC's wire layer falls back to HTTP 500 for unknown codes without one.
 * Canonical codes keep their built-in status and must not restate it.
 */
export function defineErrors<const T extends ErrorMap>(
  errors: Readonly<T & NoInfer<StatusedErrorMap<T>>>,
): T {
  return errors;
}
