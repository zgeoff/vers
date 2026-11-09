import { createORPCClient, safe } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';
import { CreateQAAccountInputSchema } from '@vers/contract-activity';
import { runCommandLine } from '@vers/scripts';
import { define } from 'gunshi';
import * as z from 'zod';
import { formatQASeedError } from '../format-qa-seed-error';
import { parseHostTarget } from '../parse-host-target';
import { parseQAUser } from '../parse-qa-user';
import { QA_SEED_ARGS } from '../qa-seed-args';
import { requireEnvVar } from '../require-env-var';

type QASeedClient = ContractRouterClient<Pick<typeof activityContract, 'createQAAccount'>>;

const entry = define({
  name: 'qa-seed',
  description:
    'create a verified QA account with an avatar at a level, optionally with verified runs, through the web app',
  args: QA_SEED_ARGS,
  run: async (ctx) => {
    const options = ctx.values;
    const parsed = parseQAUser(options.user);

    if (parsed.kind === 'refused') {
      throw new Error(parsed.reason);
    }

    const target = parseHostTarget('--origin', options.origin);

    console.log(`target: ${target.host}`);

    if (!target.isLoopback && !options.yes) {
      throw new Error(`${target.host} is not a loopback host; pass --yes to seed through it`);
    }

    const input = CreateQAAccountInputSchema.safeParse({
      level: options.level,
      password: options.password,
      runs: options.runs,
      twoFactor: options['two-factor'],
      user: parsed.user.name,
    });

    if (!input.success) {
      throw new Error(z.prettifyError(input.error));
    }

    const token = requireEnvVar('QA_SEED_TOKEN', 'the web app seeds only for its QA token holder');

    const client: QASeedClient = createORPCClient(
      new RPCLink({
        headers: { authorization: `Bearer ${token}` },
        url: new URL('/api/qa', options.origin).href,
      }),
    );

    const [error, account] = await safe(client.createQAAccount(input.data));

    if (error !== null) {
      throw new Error(formatQASeedError(error, { host: target.host, user: parsed.user.name }));
    }

    console.log(`email: ${account.user.email}`);
    console.log(`password: ${account.password}`);
    console.log(`user id: ${account.user.id}`);

    console.log(
      `avatar: ${account.avatar.name} (${account.avatar.id}) level ${account.avatar.level}, xp ${account.avatar.xp}`,
    );

    for (const run of account.runs) {
      console.log(
        `run ${run.id}: ${run.outcome}, ${run.checkpoints} checkpoints, xp ${run.xpDelta}, ${run.items} items`,
      );
    }

    if (account.twoFactor !== null) {
      console.log(`two-factor secret: ${account.twoFactor.secret}`);
      console.log(`two-factor uri: ${account.twoFactor.uri}`);
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
