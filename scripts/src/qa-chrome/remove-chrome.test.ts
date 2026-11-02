import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, passthrough } from 'msw';
import { server } from '../mocks/node';
import { buildChromePaths } from './build-chrome-paths';
import { createChrome } from './create-chrome';
import { readProcessStartTime } from './read-process-start-time';
import { removeChrome } from './remove-chrome';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-chrome-remove-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  const listener = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => {} } });
  const port = listener.port;

  listener.stop(true);
  server.use(http.get(`http://127.0.0.1:${port}/json/version`, () => passthrough()));

  return { paths: buildChromePaths(stateHome, '/unused'), port, stateHome };
}

test('it stops the browser with every process in its group', async () => {
  const ctx = await setupTest();

  const helperPIDFile = join(ctx.stateHome, 'helper.pid');
  const fakeBrowser = `Bun.serve({ hostname: '127.0.0.1', port: ${ctx.port}, fetch: () => Response.json({}) });`;

  const state = await createChrome({
    command: [
      'sh',
      '-c',
      `sleep 30 & echo $! > '${helperPIDFile}'; exec '${process.execPath}' -e "$0"`,
      fakeBrowser,
    ],
    isNetns: false,
    paths: ctx.paths,
    port: ctx.port,
  });

  const helperPIDText = await readFile(helperPIDFile, 'utf8');

  const helperPID = Number(helperPIDText);

  await removeChrome(state);

  const leaderStartTime = await readProcessStartTime(state.leaderPID);
  const helperStartTime = await readProcessStartTime(helperPID);

  expect({ helperStartTime, leaderStartTime }).toStrictEqual({
    helperStartTime: undefined,
    leaderStartTime: undefined,
  });
});
