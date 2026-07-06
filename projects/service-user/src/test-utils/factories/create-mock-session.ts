import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Sessions } from '@vers/db';
import type { Insertable } from 'kysely';

interface CreateMockSessionData extends Partial<Insertable<Sessions>> {
  readonly userId: string;
}

/** A plain, unpersisted session row with faker-generated defaults; requires an owning user. */
export function createMockSession(data: Readonly<CreateMockSessionData>): Insertable<Sessions> {
  return {
    expiresAt: faker.date.future(),
    id: createId(),
    ipAddress: faker.internet.ip(),
    ...data,
  };
}
