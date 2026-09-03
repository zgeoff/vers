export function runUnsupported(): Promise<never> {
  return Promise.reject(
    new Error('this verification type is not supported by the verify-otp route'),
  );
}
