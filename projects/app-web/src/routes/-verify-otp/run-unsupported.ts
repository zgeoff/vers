/**
 * `2fa-setup` verification isn't confirmed through this shared hub — enabling 2FA has its own
 * bespoke UI (account settings, not yet built) that verifies inline.
 */
export function runUnsupported(): Promise<never> {
  return Promise.reject(
    new Error('this verification type is not supported by the verify-otp route'),
  );
}
