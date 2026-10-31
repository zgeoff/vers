import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runE2EBrowserInstall } from './run-e2e-browser-install';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-browser-install-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test('it points apt at the archives folder before playwright installs', async () => {
  const ctx = await setupTest();

  const aptConfigPath = join(ctx.directory, '90-browser-packages');
  const archivesPath = join(ctx.directory, 'apt-archives');

  await createStubCommand('sudo', 'exec "$@"');
  await createStubCommand('bun', ':');

  await runE2EBrowserInstall({
    aptConfigPath,
    archivesPath,
    browsers: ['chromium'],
    user: String(userInfo().uid),
  });

  const aptConfig = await readFile(aptConfigPath, 'utf8');

  expect(aptConfig).toBe(
    `Dir::Cache::Archives "${archivesPath}";\nAPT::Keep-Downloaded-Packages "true";\nAcquire::Retries "3";\n`,
  );
});

test("it creates the archives folder with apt's partial folder inside", async () => {
  const ctx = await setupTest();

  const archivesPath = join(ctx.directory, 'apt-archives');
  const listPath = join(ctx.directory, 'list');

  await createStubCommand('sudo', 'exec "$@"');
  await createStubCommand('bun', `ls '${archivesPath}' > '${listPath}'`);

  await runE2EBrowserInstall({
    aptConfigPath: join(ctx.directory, '90-browser-packages'),
    archivesPath,
    browsers: ['chromium'],
    user: String(userInfo().uid),
  });

  const list = await readFile(listPath, 'utf8');

  expect(list).toBe('partial\n');
});

test('it installs each browser it is given with its system packages', async () => {
  const ctx = await setupTest();

  const argsPath = join(ctx.directory, 'args');

  await createStubCommand('sudo', 'exec "$@"');
  await createStubCommand('bun', `printf '%s\\n' "$*" > '${argsPath}'`);

  await runE2EBrowserInstall({
    aptConfigPath: join(ctx.directory, '90-browser-packages'),
    archivesPath: join(ctx.directory, 'apt-archives'),
    browsers: ['chromium', 'firefox', 'webkit'],
    user: String(userInfo().uid),
  });

  const args = await readFile(argsPath, 'utf8');

  expect(args).toBe('run playwright install --with-deps --only-shell chromium firefox webkit\n');
});

test('it gives the archives folder back to the job user for the cache save', async () => {
  const ctx = await setupTest();

  const commandsPath = join(ctx.directory, 'commands');

  await createStubCommand('sudo', `printf '%s\\n' "$1" >> '${commandsPath}'\nexec "$@"`);
  await createStubCommand('bun', ':');

  await runE2EBrowserInstall({
    aptConfigPath: join(ctx.directory, '90-browser-packages'),
    archivesPath: join(ctx.directory, 'apt-archives'),
    browsers: ['chromium'],
    user: String(userInfo().uid),
  });

  const commands = await readFile(commandsPath, 'utf8');

  expect(commands).toBe('tee\nchown\n');
});

test('it rejects a playwright install that fails', async () => {
  const ctx = await setupTest();

  await createStubCommand('sudo', 'exec "$@"');
  await createStubCommand('bun', "echo 'E: Unable to fetch some archives' >&2\nexit 100");

  const install = runE2EBrowserInstall({
    aptConfigPath: join(ctx.directory, '90-browser-packages'),
    archivesPath: join(ctx.directory, 'apt-archives'),
    browsers: ['chromium'],
    user: String(userInfo().uid),
  });

  expect(install).rejects.toThrow();
});
