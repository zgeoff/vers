import { expect, test } from 'bun:test';
import { renderDBHubTOML } from './render-dbhub-toml';

const config = {
  devDSN: 'postgresql://mcp_dev:pw@dev-host/dev_geoffbox_main?sslmode=verify-full',
  ensureCommand: 'bun /repo/scripts/src/bin/pg-dev-ensure.ts dev_geoffbox_main',
  prodDSN: 'postgresql://mcp_ro:pw@prod-host/vers?sslmode=verify-full',
};

test('it renders both sources as lazy', () => {
  const toml = renderDBHubTOML(config);

  expect(toml.match(/lazy = true/g)).toHaveLength(2);
  expect(toml).toInclude('id = "prod"');
  expect(toml).toInclude('id = "dev"');
});

test('it marks only the prod execute_sql tool readonly', () => {
  const toml = renderDBHubTOML(config);
  const prodTool = toml.slice(toml.indexOf('source = "prod"\nreadonly'));

  expect(toml.match(/readonly = true/g)).toHaveLength(1);
  expect(prodTool).toStartWith('source = "prod"\nreadonly = true');
});

test('it wires the ensure command to the dev source only', () => {
  const toml = renderDBHubTOML(config);
  const devSource = toml.slice(toml.indexOf('id = "dev"'), toml.indexOf('[[tools]]'));

  expect(devSource).toInclude(`init_command = "${config.ensureCommand}"`);
  expect(toml.match(/init_command/g)).toHaveLength(1);
});

test('it embeds each DSN on its own source', () => {
  const toml = renderDBHubTOML(config);
  const devSource = toml.slice(toml.indexOf('id = "dev"'), toml.indexOf('[[tools]]'));
  const prodSource = toml.slice(toml.indexOf('id = "prod"'), toml.indexOf('id = "dev"'));

  expect(prodSource).toInclude(config.prodDSN);
  expect(devSource).toInclude(config.devDSN);
});
