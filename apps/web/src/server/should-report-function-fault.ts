import { isNotFound, isRedirect } from '@tanstack/react-router';

// a redirect, a not-found, and a thrown `Response` are outcomes a server function signals by
// throwing; only what remains is a fault
export function shouldReportFunctionFault(error: unknown): boolean {
  return !isRedirect(error) && !isNotFound(error) && !(error instanceof Response);
}
