export function getErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }

  if (
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'An unknown error occurred';
}
