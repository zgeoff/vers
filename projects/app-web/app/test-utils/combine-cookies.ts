/**
 * Combines a Set-Cookie header from session storage with an existing
 * Cookie header for the sake of ensuring it's in the correct format
 * to be used as a final request Cookie header.
 *
 * Header#append does NOT append the Cookie header in the correct format.
 *
 * @param existingCookieHeader - The existing Cookie header from the request.
 * @param setCookieHeader - The Set-Cookie header to be added to the request.
 * @returns The combined cookie header.
 */
export function combineCookies(existingCookieHeader: null | string, setCookieHeader: string) {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  return existingCookieHeader
    ? `${existingCookieHeader}; ${setCookieHeader.split(';')[0]}`
    : setCookieHeader;
}
