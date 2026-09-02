import { logger } from '../../server/logger';
import { HONEYPOT_FIELD_NAME, HONEYPOT_VALID_FROM_FIELD_NAME } from './honeypot-field-names';
import { SpamError } from './spam-error';

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

  if (!Number.isFinite(validFromMs) || validFromMs <= 0) {
    logger.warn({ reason: 'missing-valid-from' }, 'form submission flagged as spam');
    throw new SpamError('Form not submitted properly');
  }

  if (Date.now() < validFromMs) {
    logger.warn({ reason: 'timing' }, 'form submission flagged as spam');
    throw new SpamError('Form not submitted properly');
  }
}
