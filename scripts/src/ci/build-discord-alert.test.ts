import { expect, test } from 'bun:test';
import { buildDiscordAlert } from './build-discord-alert';

test('it builds one critical embed that links the run', () => {
  expect(
    buildDiscordAlert({
      title: '[CI] critical — nightly sweep failed',
      runURL: 'https://github.com/acme/kiln/actions/runs/42',
      description: 'the sweep failed; open the run',
      failedJobs: undefined,
    }),
  ).toStrictEqual({
    embeds: [
      {
        title: '[CI] critical — nightly sweep failed',
        url: 'https://github.com/acme/kiln/actions/runs/42',
        description: 'the sweep failed; open the run',
        color: 15_026_253,
      },
    ],
  });
});

test('it lists the failed jobs in a field when the alert names them', () => {
  expect(
    buildDiscordAlert({
      title: '[CI] critical — main pipeline failed',
      runURL: 'https://github.com/acme/kiln/actions/runs/43',
      description: 'add the glaze picker',
      failedJobs: 'checks=success, deploy=failure',
    }),
  ).toStrictEqual({
    embeds: [
      {
        title: '[CI] critical — main pipeline failed',
        url: 'https://github.com/acme/kiln/actions/runs/43',
        description: 'add the glaze picker',
        color: 15_026_253,
        fields: [{ name: 'Failed jobs', value: 'checks=success, deploy=failure' }],
      },
    ],
  });
});

test("it keeps only the description's first line, such as a commit message's subject", () => {
  const alert = buildDiscordAlert({
    title: '[CI] critical — main pipeline failed',
    runURL: 'https://github.com/acme/kiln/actions/runs/44',
    description: 'fix the kiln timer\n\nThe timer drifted after a pause.',
    failedJobs: undefined,
  });

  expect(alert.embeds[0]?.description).toBe('fix the kiln timer');
});
