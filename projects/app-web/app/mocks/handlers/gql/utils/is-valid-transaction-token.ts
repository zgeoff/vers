/**
 * Validates a transaction token in our MSW mocks. If the token contains the
 * word 'valid', it is considered valid.
 *
 * @param token - The transaction token to check
 * @returns True if the transaction token is valid, false otherwise
 */
export function isValidTransactionToken(token?: null | string) {
  return Boolean(token?.includes('valid'));
}
