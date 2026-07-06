import { createId } from '@paralleldrive/cuid2';
import type { UserData } from '@vers/contract-user';
import type { DB } from '@vers/db';
import { createSeed } from '@vers/game-utils';
import type { Kysely } from 'kysely';
import type { FieldConflictPayload } from '../types';
import { toUserData } from './to-user-data';

/** oRPC handler opts for the `createUser` procedure. */
interface CreateUserOpts {
  readonly errors: {
    readonly CONFLICT: (payload: FieldConflictPayload<'email' | 'username'>) => Error;
  };
  readonly input: {
    readonly email: string;
    readonly name: string;
    readonly password: string;
    readonly username: string;
  };
}

/** Creates a user with an argon2id-hashed password; throws CONFLICT when the email or username is taken. */
export async function createUser(db: Kysely<DB>, opts: CreateUserOpts): Promise<UserData> {
  const passwordHash = await Bun.password.hash(opts.input.password, 'argon2id');

  try {
    const row = await db
      .insertInto('users')
      .values({
        email: opts.input.email,
        id: createId(),
        name: opts.input.name,
        passwordHash,
        seed: createSeed(),
        username: opts.input.username,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toUserData(row);
  } catch (error: unknown) {
    const field = findViolatedField(error);

    if (field === undefined) {
      throw error;
    }

    throw opts.errors.CONFLICT({ data: { field } });
  }
}

/** postgres.js surfaces a unique-constraint violation as SQLSTATE 23505, naming the constraint. */
function findViolatedField(error: unknown): 'email' | 'username' | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code: unknown }).code !== '23505' ||
    !('constraint_name' in error)
  ) {
    return undefined;
  }

  const constraintName = (error as { constraint_name: unknown }).constraint_name;

  if (constraintName === 'users_email_unique') {
    return 'email';
  }

  if (constraintName === 'users_username_unique') {
    return 'username';
  }

  return undefined;
}
