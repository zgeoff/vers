import { join } from 'node:path';
import { browser } from '@wringer/browser';
import { WringerError, createWringer, local } from '@wringer/core';
import type { Wringer } from '@wringer/core';
import { db } from '@wringer/db';
import { http } from '@wringer/http';
import { z } from 'zod';
import { featurePaths, ignoredPaths, sharedPaths } from './feature-paths';
import { game } from './game/game';
import { deviceSchema } from './game/game-service-contract';
import { toCredentialedURL } from './local/create-postgres-container';
import { pickAccountRefusal } from './pick-account-refusal';
import { readLastEmail } from './read-last-email';
import { stackHealthEndpoints } from './stack-health-endpoints';

export interface VerifyRegistryOptions {
  // the Chromium the browser driver starts, through a launcher that opens a DevTools port on it
  readonly chromiumLauncher: string;
  readonly devtoolsPort: number;
}

const stackPath = join(import.meta.dir, 'local', 'run-local-stack.ts');

const qaResetPath = join(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'libs',
  'testing',
  'qa-account',
  'src',
  'bin',
  'qa-reset.ts',
);

const stackCheckDataSchema = z.strictObject({ healthy: z.array(z.string()) });

const refusalHint =
  'This target refuses the command. Leave it undone, skip `done` for this feature, and report the command you needed.';

// The registry's name is not `vers`: gunshi reads a command group named like the program as the
// program itself.
export function createVerifyRegistry(options: VerifyRegistryOptions): Wringer {
  return createWringer({ name: 'vers-verify' })
    .use(browser({ executablePath: options.chromiumLauncher, actionTimeoutMs: 15_000 }))
    .use(http({}))
    .use(db({}))
    .use(game({ devtoolsPort: options.devtoolsPort }))
    .target('local', {
      mode: 'launch',
      access: 'read-write',
      refusalHint,
      host: local(),
      launch: () => ({
        command: [process.execPath, stackPath],
        ready: (line) =>
          line['event'] === 'ready'
            ? Object.fromEntries(
                Object.entries(line).flatMap(([key, value]) =>
                  key === 'event' ? [] : [[key, String(value)]],
                ),
              )
            : null,
      }),
      drivers: {
        browser: () => ({}),
        http: () => ({ endpoint: 'resend', healthPath: '/health' }),
        db: (ctx) => ({
          via: 'sql',
          adapter: 'postgres',
          url: toCredentialedURL(String(ctx.endpoints['db'])),
        }),
        game: () => ({}),
      },
    })
    .action({
      name: 'read-email',
      summary:
        'Read the code in the last email the Resend stub captured for --to, waiting up to 20 s for it',
      effect: 'read',
      input: z.strictObject({ to: z.email() }),
      data: z.strictObject({ subject: z.string(), code: z.string() }),
      timeoutMs: 30_000,
      run: (input, ctx) => readLastEmail(ctx.drivers.http, input.to, ctx.signal),
    })
    .action({
      name: 'read-game-state',
      summary:
        "Read the writer worker's state through the page's QA hook: its live run, outbox and events. The hook answers only on a game page of a qa.versidle.com account",
      effect: 'read',
      input: z.strictObject({ device: deviceSchema.default('first') }),
      data: z.strictObject({ url: z.string(), state: z.unknown() }),
      run: (input, ctx) => ctx.drivers.game.readState(input),
    })
    .action({
      name: 'navigate-route',
      summary:
        "Move the page's client router to --path, as a click on a world-map node does, with no page load",
      effect: 'write',
      input: z.strictObject({
        path: z.string().startsWith('/'),
        device: deviceSchema.default('first'),
      }),
      data: z.strictObject({ url: z.string() }),
      run: (input, ctx) => ctx.drivers.game.navigate(input),
    })
    .action({
      name: 'set-network',
      summary:
        "Cut the network for the browser's page and its SharedWorker (--network offline), or bring it back (--network online)",
      effect: 'write',
      input: z.strictObject({ network: z.enum(['offline', 'online']) }),
      data: z.strictObject({ network: z.enum(['offline', 'online']), workers: z.number().int() }),
      run: (input, ctx) => ctx.drivers.game.setNetwork(input),
    })
    .action({
      name: 'second-device-sign-in',
      summary:
        'Sign in on a second device, a new browser context each time, and confirm the takeover the sign-in asks for',
      effect: 'write',
      input: z.strictObject({ email: z.email(), password: z.string().min(1) }),
      data: z.strictObject({ url: z.string(), tookOver: z.boolean() }),
      timeoutMs: 60_000,
      run: (input, ctx) => ctx.drivers.game.signInSecond(input),
    })
    .action({
      name: 'second-device-click',
      summary: 'Click the element with --role and the exact --name on the second device',
      effect: 'write',
      input: z.strictObject({ role: z.string().min(1), name: z.string() }),
      data: z.strictObject({ url: z.string() }),
      run: (input, ctx) => ctx.drivers.game.clickSecond(input),
    })
    .action({
      name: 'second-device-snapshot',
      summary: "Print the second device's page as an accessibility tree",
      effect: 'read',
      input: z.strictObject({}),
      data: z.strictObject({ url: z.string(), snapshot: z.string() }),
      run: (_input, ctx) => ctx.drivers.game.snapshotSecond(),
    })
    .action({
      name: 'remove-account',
      summary:
        'Remove a journey account, wv-<run>@qa.versidle.com, with its avatars, runs and sessions',
      effect: 'write',
      input: z.strictObject({ email: z.email() }),
      data: z.strictObject({ removed: z.string() }),
      timeoutMs: 30_000,
      run: async (input, ctx) => {
        const refusal = pickAccountRefusal(input.email);

        if (refusal !== null) {
          throw new WringerError('usage', { message: refusal });
        }

        const ran = await ctx.exec([
          'env',
          `DATABASE_URL=${toCredentialedURL(String(ctx.endpoints['db']))}`,
          process.execPath,
          qaResetPath,
          '--user',
          input.email,
          '--all',
        ]);

        if (ran.exitCode !== 0) {
          throw new WringerError('check-failed', {
            message: `qa-reset failed: ${ran.stderr.trim()}`,
          });
        }

        return { removed: ran.stdout.trim().split('\n').at(-1) ?? '' };
      },
    })
    .check({
      name: 'stack',
      input: z.strictObject({}),
      data: stackCheckDataSchema,
      timeoutMs: 15_000,
      run: async (_input, ctx) => {
        const healthy: Array<string> = [];

        for (const name of stackHealthEndpoints) {
          const response = await fetch(`${ctx.endpoints[name] ?? ''}/health`, {
            signal: ctx.signal,
          }).catch(() => null);

          if (response?.ok !== true) {
            throw new WringerError('check-failed', {
              message: `${name} does not answer /health`,
              hint: 'Read the run log, then run `bun verify up --restart` and `bun verify doctor`.',
            });
          }

          healthy.push(name);
        }

        return { healthy };
      },
    })
    .feature(
      {
        name: 'signup',
        summary: 'Sign up with an emailed code, and land signed in with a user row',
        paths: featurePaths.signup,
      },
      {
        name: 'device-takeover',
        summary: 'Sign in on a second device, and see the first one told it was taken over',
        paths: featurePaths['device-takeover'],
      },
      {
        name: 'offline-run',
        summary: 'Start a run offline, and see it sync and verify once the network returns',
        paths: featurePaths['offline-run'],
      },
      {
        name: 'avatar-roster',
        summary: 'Create and switch avatars, and see the roster and the database agree',
        paths: featurePaths['avatar-roster'],
      },
    )
    .shared(...sharedPaths)
    .ignore(...ignoredPaths)
    .build();
}
