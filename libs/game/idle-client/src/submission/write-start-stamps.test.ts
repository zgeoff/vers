import { expect, test } from 'bun:test';
import { readStartStamps } from './read-start-stamps';
import { writeStartStamps } from './write-start-stamps';

test('it overwrites the previously cached stamps with a newer pair', async () => {
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });
  await writeStartStamps({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });
});

test('it keeps the newer cached stamps when a later write carries an older key version', async () => {
  await writeStartStamps({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 1 });
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 5 });

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 1 });
});

test('it keeps the newer cached stamps when a later write carries an older secret version at the same key version', async () => {
  await writeStartStamps({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });
  await writeStartStamps({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 1 });

  const stamps = await readStartStamps();

  expect(stamps).toStrictEqual({ keyVersion: 2, secretRef: 'worldmap', secretVersion: 3 });
});
