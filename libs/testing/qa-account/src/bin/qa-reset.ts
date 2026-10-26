import { createDB } from '@vers/db';
import { runCommandLine } from '@vers/scripts';
import { define } from 'gunshi';
import { applyQAReset } from '../apply-qa-reset';
import { env } from '../env';
import { parseDatabaseTarget } from '../parse-database-target';
import { parseQAUser } from '../parse-qa-user';
import { QA_RESET_ARGS } from '../qa-reset-args';

const entry = define({
  name: 'qa-reset',
  description: "delete a QA account's activity history and avatar progress, or the whole account",
  args: QA_RESET_ARGS,
  run: async (ctx) => {
    const options = ctx.values;
    const user = parseQAUser(options.user);
    const target = parseDatabaseTarget(env.DATABASE_URL);

    console.log(`target: ${target.host}`);

    if (!target.isLoopback && !options.yes) {
      throw new Error(`${target.host} is not a loopback host; pass --yes to reset on it`);
    }

    const db = createDB({ databaseURL: env.DATABASE_URL });

    try {
      const reset = await applyQAReset(db, { all: options.all, user });

      const summary = reset.removedAccount
        ? `removed ${user.email} with ${reset.avatars} avatar(s) and ${reset.activities} activities`
        : `reset ${user.email}: ${reset.activities} activities removed, ${reset.avatars} avatar(s) back at level 1`;

      console.log(summary);
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
  console.error(`qa-reset: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
