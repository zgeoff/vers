import { createDB } from '@vers/db';
import { Command } from 'commander';
import { applyQAReset } from '../apply-qa-reset';
import { env } from '../env';
import { parseDatabaseTarget } from '../parse-database-target';
import { parseQAUser } from '../parse-qa-user';

interface ResetCommandOptions {
  readonly all: boolean;
  readonly user: string;
  readonly yes: boolean;
}

const program = new Command()
  .name('qa-reset')
  .description("delete a QA account's activity history and avatar progress, or the whole account")
  .requiredOption('--user <name>', 'account name; the address is <name>@qa.versidle.com')
  .option('--all', 'delete the account itself instead of resetting its progress', false)
  .option('--yes', 'act on a database host that is not a loopback address', false)
  .action(async (options: ResetCommandOptions) => {
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
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`qa-reset: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
