import { expect, test } from 'bun:test';
import { readStartStamps } from './read-start-stamps';
import { writeStartStamps } from './write-start-stamps';

test('it overwrites the previously cached stamps', async () => {
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });
  await writeStartStamps({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });
});
