import { createId } from '@paralleldrive/cuid2';
import { verificationCollection } from '../../db/verification-collection';
import { os } from './os';

/**
 * Replaces any existing code for the same target+type, mirroring the real service's
 * `(target, type)` uniqueness — a recreated verification never leaves a stale code verifiable
 * alongside the fresh one.
 */
export const createVerification = os.createVerification.handler(async (opts) => {
  const existing = verificationCollection.findFirst((q) =>
    q.where({ target: opts.input.target, type: opts.input.type }),
  );

  if (existing !== undefined) {
    verificationCollection.delete(existing);
  }

  const code = buildMockCode();

  const row = await verificationCollection.create({
    id: createId(),
    code,
    expiresAt: opts.input.expiresAt ?? null,
    target: opts.input.target,
    type: opts.input.type,
  });

  return { id: row.id, otp: code, target: row.target, type: row.type };
});

function buildMockCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}
