import { randomBytes, randomInt } from 'node:crypto';
import { createGenesisSeed } from '@vers/contract-activity';
import { createDB } from '@vers/db';
import { Command, InvalidArgumentError } from 'commander';
import { QA_KEY_VERSION, QA_SCOPE_SECRET_VERSION, applyQASeed } from '../apply-qa-seed';
import { buildPasswordFromBytes } from '../build-password-from-bytes';
import { env } from '../env';
import { parseDatabaseTarget } from '../parse-database-target';
import { parseKeyRoots } from '../parse-key-roots';
import { parseQAUser } from '../parse-qa-user';
import { requireEnvVar } from '../require-env-var';
import type { KeyRoots } from '../types';

const PASSWORD_ENTROPY_BYTES = 20;

interface SeedCommandOptions {
  readonly level: number;
  readonly password?: string;
  readonly runs: number;
  readonly twoFactor: boolean;
  readonly user: string;
  readonly yes: boolean;
}

const program = new Command()
  .name('qa-seed')
  .description(
    'create a verified QA account with an avatar at a level, optionally with verified runs',
  )
  .requiredOption('--user <name>', 'account name; the address is <name>@qa.versidle.com')
  .requiredOption('--level <n>', 'avatar level, at least 1', parsePositiveInteger)
  .option('--runs <n>', 'completed, verified runs to seed on the origin node', parseCount, 0)
  .option('--two-factor', 'enable two-factor sign-in and print its secret', false)
  .option('--password <password>', 'password to set; generated and printed when absent')
  .option('--yes', 'act on a database host that is not a loopback address', false)
  .action(async (options: SeedCommandOptions) => {
    const user = parseQAUser(options.user);
    const target = parseDatabaseTarget(env.DATABASE_URL);

    console.log(`target: ${target.host}`);

    if (!target.isLoopback && !options.yes) {
      throw new Error(`${target.host} is not a loopback host; pass --yes to seed it`);
    }

    const keyRoots = options.runs > 0 ? readKeyRoots() : undefined;

    const password =
      options.password ?? buildPasswordFromBytes(randomBytes(PASSWORD_ENTROPY_BYTES));

    const db = createDB({ databaseURL: env.DATABASE_URL });

    try {
      const seeded = await applyQASeed(db, {
        entropy: { genesisSeed: createGenesisSeed(), userSeed: randomInt(0, 2 ** 31) },
        keyRoots,
        level: options.level,
        now: new Date(),
        password,
        runs: options.runs,
        twoFactor: options.twoFactor,
        user,
      });

      console.log(`email: ${seeded.user.email}`);
      console.log(`password: ${password}`);
      console.log(`user id: ${seeded.user.id}`);

      console.log(
        `avatar: ${seeded.avatar.name} (${seeded.avatar.id}) level ${seeded.avatar.level}, xp ${seeded.avatar.xp}`,
      );

      for (const run of seeded.runs) {
        console.log(
          `run ${run.id}: ${run.outcome}, ${run.checkpoints} checkpoints, xp ${run.xpDelta}, ${run.items} items`,
        );
      }

      if (seeded.twoFactor !== null) {
        console.log(`two-factor secret: ${seeded.twoFactor.secret}`);
        console.log(`two-factor uri: ${seeded.twoFactor.uri}`);
      }
    } finally {
      await db.destroy();
    }
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`qa-seed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function readKeyRoots(): KeyRoots {
  return parseKeyRoots(
    {
      rollKeyRoots: requireEnvVar(
        'ROLL_KEY_ROOTS',
        'seeded runs mint their items from the avatar key',
      ),
      scopeSecretRoots: requireEnvVar(
        'SCOPE_SECRET_ROOTS',
        'seeded runs derive their encounter from the scope secret',
      ),
    },
    { keyVersion: QA_KEY_VERSION, secretVersion: QA_SCOPE_SECRET_VERSION },
  );
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('expected an integer of at least 1');
  }

  return parsed;
}

function parseCount(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError('expected a non-negative integer');
  }

  return parsed;
}
