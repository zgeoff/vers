import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, passthrough } from 'msw';
import { server } from '../mocks/node';
import { buildChromePaths } from './build-chrome-paths';
import { createChrome } from './create-chrome';
import { readProcessStartTime } from './read-process-start-time';
import { removeProcessGroup } from './remove-process-group';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-chrome-create-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  const listener = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => {} } });
  const port = listener.port;

  listener.stop(true);
  server.use(http.get(`http://127.0.0.1:${port}/json/version`, () => passthrough()));

  return { paths: buildChromePaths(stateHome, '/unused'), port, stateHome };
}

test('it returns the running browser once its DevTools endpoint answers', async () => {
  const ctx = await setupTest();

  const fakeBrowser = `Bun.serve({ hostname: '127.0.0.1', port: ${ctx.port}, fetch: () => Response.json({}) });`;

  const state = await createChrome({
    command: [process.execPath, '-e', fakeBrowser],
    isNetns: false,
    paths: ctx.paths,
    port: ctx.port,
  });

  onTestFinished(() => removeProcessGroup(state.leaderPID, 1000));

  const startTime = await readProcessStartTime(state.leaderPID);

  expect(state).toStrictEqual({
    leaderPID: expect.any(Number),
    leaderStartTime: expect.any(String),
    namespace: null,
    port: ctx.port,
  });

  expect(startTime).toBe(state.leaderStartTime);
});

test('it throws with the end of the log when the browser exits before it answers', async () => {
  const ctx = await setupTest();

  const creating = createChrome({
    command: ['sh', '-c', 'echo "Socket path too long" >&2; exit 3'],
    isNetns: false,
    paths: ctx.paths,
    port: ctx.port,
  });

  expect(creating).rejects.toThrow(
    `the browser exited with code 3; the end of ${ctx.paths.logFile}:\nSocket path too long`,
  );
});

test('it stops what the browser left running when the browser exits before it answers', async () => {
  const ctx = await setupTest();

  const helperPIDFile = join(ctx.stateHome, 'helper.pid');

  const outcome = await createChrome({
    command: ['sh', '-c', `sleep 30 & echo $! > '${helperPIDFile}'; exit 3`],
    isNetns: false,
    paths: ctx.paths,
    port: ctx.port,
  }).then(
    () => 'created',
    () => 'refused',
  );

  const helperPIDText = await readFile(helperPIDFile, 'utf8');
  const helperStartTime = await readProcessStartTime(Number(helperPIDText));

  expect({ helperStartTime, outcome }).toStrictEqual({
    helperStartTime: undefined,
    outcome: 'refused',
  });
});
