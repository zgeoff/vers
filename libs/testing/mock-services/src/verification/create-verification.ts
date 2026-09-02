import { createId } from '@paralleldrive/cuid2';
import * as db from '../db';
import { os } from './os';

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
    expiresAt: opts.input.expiresAt ?? null,
    target: opts.input.target,
    type: opts.input.type,
  });

  return { id: row.id, otp: code, target: row.target, type: row.type };
});

function buildMockCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}
