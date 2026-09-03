import { createId } from '@paralleldrive/cuid2';
import type { VerificationType } from '@vers/contract-verification';
import * as db from '../db';
import { os } from './os';

const EMAILED_TYPES: ReadonlySet<VerificationType> = new Set(['change-email', 'onboarding']);

const EMAILED_CODE_LIFETIME_MS = 600_000;

export const createVerification = os.createVerification.handler(async (opts) => {
  const existing = db.verificationCollection.findFirst((q) =>
    q.where({ target: opts.input.target, type: opts.input.type }),
  );

  if (existing !== undefined) {
    db.verificationCollection.delete(existing);
  }

  const code = buildMockCode();

  const row = await db.verificationCollection.create({
    id: createId(),
    code,
    expiresAt:
      opts.input.expiresAt === undefined
        ? pickDefaultExpiry(opts.input.type)
        : opts.input.expiresAt,
    target: opts.input.target,
    type: opts.input.type,
  });

  return { id: row.id, otp: code, target: row.target, type: row.type };
});

function pickDefaultExpiry(type: VerificationType): Date | null {
  return EMAILED_TYPES.has(type) ? new Date(Date.now() + EMAILED_CODE_LIFETIME_MS) : null;
}

function buildMockCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}
