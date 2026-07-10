/**
 * A form submission a honeypot check flagged as spam.
 */
export class SpamError extends Error {
  public override readonly name = 'SpamError';
}
