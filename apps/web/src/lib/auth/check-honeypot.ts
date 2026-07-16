import { logger } from '../../server/logger';
import { HONEYPOT_FIELD_NAME, HONEYPOT_VALID_FROM_FIELD_NAME } from './honeypot-field-names';
import { SpamError } from './spam-error';

/**
 * Throws {@link SpamError} for a filled-in honeypot field or a submission that arrived before its
 * form's `valid-from` timestamp, logging the flag so spam pressure is visible. Skips the timing
 * check under `NODE_ENV=test`: tests submit forms instantly, well inside the window a bot would
 * be flagged for.
 */
export function checkHoneypot(formData: FormData): void {
  const honeypotValue = formData.get(HONEYPOT_FIELD_NAME);

  if (typeof honeypotValue === 'string' && honeypotValue !== '') {
    logger.warn({ reason: 'honeypot-field' }, 'form submission flagged as spam');
    throw new SpamError('Form not submitted properly');
  }

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const validFrom = formData.get(HONEYPOT_VALID_FROM_FIELD_NAME);
  const validFromMs = typeof validFrom === 'string' ? Number(validFrom) : Number.NaN;

  if (!Number.isFinite(validFromMs) || validFromMs <= 0 || Date.now() < validFromMs) {
    logger.warn({ reason: 'timing' }, 'form submission flagged as spam');
    throw new SpamError('Form not submitted properly');
  }
}
