import { expect, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { waitFor } from '@vers/test-utils';
import { createLifecycleMailbox } from './create-lifecycle-mailbox';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

test('it runs queued turns strictly one at a time in queue order', async () => {
  const mailbox = createLifecycleMailbox();
  const order: Array<string> = [];
  let releaseFirst: (() => void) | undefined;

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = mailbox.runTurn('start', async () => {
    order.push('first:enter');

    await firstGate;

    order.push('first:exit');
  });

  const second = mailbox.runTurn('start', () => {
    order.push('second:enter');

    return Promise.resolve();
  });

  releaseFirst?.();

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['first:enter', 'first:exit', 'second:enter']);
});

test('it serializes turns of different kinds on the one mailbox', async () => {
  const mailbox = createLifecycleMailbox();
  const order: Array<string> = [];
  let releaseStart: (() => void) | undefined;

  const startGate = new Promise<void>((resolve) => {
    releaseStart = resolve;
  });

  const start = mailbox.runTurn('start', async () => {
    order.push('start:enter');

    await startGate;

    order.push('start:exit');
  });

  const resync = mailbox.runTurn('resync', () => {
    order.push('resync:enter');

    return Promise.resolve();
  });

  const continuation = mailbox.runTurn('continuation', () => {
    order.push('continuation:enter');

    return Promise.resolve();
  });

  releaseStart?.();

  await Promise.all([start, resync, continuation]);

  expect(order).toStrictEqual(['start:enter', 'start:exit', 'resync:enter', 'continuation:enter']);
});

test('it keeps the queue alive past a turn that throws', async () => {
  const mailbox = createLifecycleMailbox();

  await expect(
    mailbox.runTurn('start', () => Promise.reject(new Error('turn exploded'))),
  ).toResolve();

  let ran = false;

  await mailbox.runTurn('start', () => {
    ran = true;

    return Promise.resolve();
  });

  expect(ran).toBeTrue();
});

test('it resolves the caller only once its own turn settles', async () => {
  const mailbox = createLifecycleMailbox();
  let settled = false;

  await mailbox.runTurn('start', async () => {
    await Promise.resolve();

    settled = true;
  });

  expect(settled).toBeTrue();
});

test('it reports an escaping turn error as a fault under its site', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const mailbox = createLifecycleMailbox();

  await mailbox.runTurn('continuation', () => Promise.reject(new Error('turn exploded')));

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ site: 'continuation' });
});

test('it drops a non-claiming resync while one is queued', async () => {
  const mailbox = createLifecycleMailbox();
  let releaseBlocking: (() => void) | undefined;
  let firstRan = false;

  const blockingGate = new Promise<void>((resolve) => {
    releaseBlocking = resolve;
  });

  const blocking = mailbox.runTurn('start', () => blockingGate);

  const first = mailbox.runResyncTurn('avatar_a', false, () => () => {
    firstRan = true;

    return Promise.resolve();
  });

  // the ticket is set the instant the first call is accepted, even though its own turn is still
  // waiting behind the blocking start turn
  await expect(
    mailbox.runResyncTurn('avatar_b', false, () => {
      throw new Error('a dropped call must never invoke prepare');
    }),
  ).toResolve();

  expect(firstRan).toBeFalse();
  releaseBlocking?.();

  await Promise.all([blocking, first]);

  expect(firstRan).toBeTrue();
});

test('it drops a non-claiming resync while one is running', async () => {
  const mailbox = createLifecycleMailbox();
  let releaseRunning: (() => void) | undefined;
  let ran = false;

  const runningGate = new Promise<void>((resolve) => {
    releaseRunning = resolve;
  });

  const running = mailbox.runResyncTurn('avatar_a', false, () => async () => {
    ran = true;

    await runningGate;
  });

  await waitFor(() => {
    expect(ran).toBeTrue();
  });

  await expect(
    mailbox.runResyncTurn('avatar_b', false, () => {
      throw new Error('a dropped call must never invoke prepare');
    }),
  ).toResolve();

  releaseRunning?.();

  await running;
});

test('it holds a claiming resync and runs it after the in-flight one settles', async () => {
  const mailbox = createLifecycleMailbox();
  let releaseFirst: (() => void) | undefined;
  const order: Array<string> = [];

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  // one plan, reused for both calls — the mailbox re-runs a held claim with whichever plan its
  // own triggering call carried, so a plan reads its avatarID argument rather than closing over
  // a fixed identity, exactly as the real binder's does
  const planResyncBody = (avatarID: string) => async () => {
    order.push(`${avatarID}:enter`);

    if (avatarID === 'avatar_a') {
      await firstGate;
    }

    order.push(`${avatarID}:exit`);
  };

  const first = mailbox.runResyncTurn('avatar_a', false, planResyncBody);

  await waitFor(() => {
    expect(order).toStrictEqual(['avatar_a:enter']);
  });

  const held = mailbox.runResyncTurn('avatar_b', true, planResyncBody);

  releaseFirst?.();

  await Promise.all([first, held]);

  expect(order).toStrictEqual([
    'avatar_a:enter',
    'avatar_a:exit',
    'avatar_b:enter',
    'avatar_b:exit',
  ]);
});

test('it keeps only the latest claiming avatar when two arrive', async () => {
  const mailbox = createLifecycleMailbox();
  let releaseFirst: (() => void) | undefined;
  const ranAvatars: Array<string> = [];

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = mailbox.runResyncTurn('avatar_a', false, (avatarID) => async () => {
    ranAvatars.push(avatarID);

    await firstGate;
  });

  const claimOne = mailbox.runResyncTurn('avatar_b', true, (avatarID) => () => {
    ranAvatars.push(avatarID);

    return Promise.resolve();
  });

  const claimTwo = mailbox.runResyncTurn('avatar_c', true, (avatarID) => () => {
    ranAvatars.push(avatarID);

    return Promise.resolve();
  });

  releaseFirst?.();

  await Promise.all([first, claimOne, claimTwo]);

  expect(ranAvatars).toStrictEqual(['avatar_a', 'avatar_c']);
});

test('it resolves a claiming arrival immediately while the first caller awaits the held follow-up', async () => {
  const mailbox = createLifecycleMailbox();
  let releaseFirst: (() => void) | undefined;
  const order: Array<string> = [];

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  // one plan, reused for both calls — see the note in the previous test on why the recursive
  // re-run needs a single avatarID-parameterized plan rather than one closure per call
  const planResyncBody = (avatarID: string) => async () => {
    if (avatarID === 'avatar_a') {
      await firstGate;
    }

    order.push(`${avatarID}:ran`);
  };

  const first = mailbox.runResyncTurn('avatar_a', false, planResyncBody);
  const heldCall = mailbox.runResyncTurn('avatar_b', true, planResyncBody);

  const held = (async () => {
    await heldCall;

    order.push('held-caller:resolved');
  })();

  await waitFor(() => {
    expect(order).toStrictEqual(['held-caller:resolved']);
  });

  releaseFirst?.();

  await Promise.all([first, held]);

  expect(order).toStrictEqual(['held-caller:resolved', 'avatar_a:ran', 'avatar_b:ran']);
});

test('it invokes prepare synchronously at accept and again at requeue', async () => {
  const mailbox = createLifecycleMailbox();
  let releaseFirst: (() => void) | undefined;
  const prepareCalls: Array<{ avatarID: string; claim: boolean }> = [];

  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const planResyncBody = (avatarID: string, claim: boolean) => {
    prepareCalls.push({ avatarID, claim });

    return () => (avatarID === 'avatar_a' ? firstGate : Promise.resolve());
  };

  const first = mailbox.runResyncTurn('avatar_a', false, planResyncBody);

  expect(prepareCalls).toStrictEqual([{ avatarID: 'avatar_a', claim: false }]);

  const held = mailbox.runResyncTurn('avatar_b', true, planResyncBody);

  expect(prepareCalls).toStrictEqual([{ avatarID: 'avatar_a', claim: false }]);
  releaseFirst?.();

  await Promise.all([first, held]);

  expect(prepareCalls).toStrictEqual([
    { avatarID: 'avatar_a', claim: false },
    { avatarID: 'avatar_b', claim: true },
  ]);
});

test('it runs a resync arriving during a non-resync turn after that turn rather than dropping it', async () => {
  const mailbox = createLifecycleMailbox();
  const order: Array<string> = [];
  let releaseStart: (() => void) | undefined;

  const startGate = new Promise<void>((resolve) => {
    releaseStart = resolve;
  });

  const start = mailbox.runTurn('start', async () => {
    order.push('start:enter');

    await startGate;

    order.push('start:exit');
  });

  const resync = mailbox.runResyncTurn('avatar_a', false, () => () => {
    order.push('resync:run');

    return Promise.resolve();
  });

  releaseStart?.();

  await Promise.all([start, resync]);

  expect(order).toStrictEqual(['start:enter', 'start:exit', 'resync:run']);
});
