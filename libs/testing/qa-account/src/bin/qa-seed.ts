import { randomBytes, randomInt } from 'node:crypto';
import { createGenesisSeed } from '@vers/contract-activity';
import { createDB } from '@vers/db';
import { runCommandLine } from '@vers/scripts';
import { define } from 'gunshi';
import { QA_KEY_VERSION, QA_SCOPE_SECRET_VERSION, applyQASeed } from '../apply-qa-seed';
import { buildPasswordFromBytes } from '../build-password-from-bytes';
import { env } from '../env';
import { parseDatabaseTarget } from '../parse-database-target';
import { parseKeyRoots } from '../parse-key-roots';
import { parseQAUser } from '../parse-qa-user';
import { QA_SEED_ARGS } from '../qa-seed-args';
import { requireEnvVar } from '../require-env-var';
import type { KeyRoots } from '../types';

const PASSWORD_ENTROPY_BYTES = 20;

const entry = define({
  name: 'qa-seed',
  description:
    'create a verified QA account with an avatar at a level, optionally with verified runs',
  args: QA_SEED_ARGS,
  run: async (ctx) => {
    const options = ctx.values;
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
        twoFactor: options['two-factor'],
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
  },
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, { output: console });

  if (!ran) {
    process.exitCode = 1;
  }
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
