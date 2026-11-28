import { expect, test } from 'bun:test';
import { collectReachedFolders } from './collect-reached-folders';

test.each([
  {
    title: 'a seed with no dependencies',
    seeds: ['services/kettle'],
    packages: [
      { folder: 'services/kettle', name: '@vers/service-kettle', workspaceDependencies: [] },
    ],
    reached: ['services/kettle'],
  },
  {
    title: 'the dependencies of a dependency',
    seeds: ['services/kettle'],
    packages: [
      {
        folder: 'services/kettle',
        name: '@vers/service-kettle',
        workspaceDependencies: ['@vers/contract-kettle'],
      },
      {
        folder: 'contracts/kettle',
        name: '@vers/contract-kettle',
        workspaceDependencies: ['@vers/steam'],
      },
      { folder: 'libs/core/steam', name: '@vers/steam', workspaceDependencies: [] },
      { folder: 'services/teapot', name: '@vers/service-teapot', workspaceDependencies: [] },
    ],
    reached: ['contracts/kettle', 'libs/core/steam', 'services/kettle'],
  },
  {
    title: 'each package of a cycle once',
    seeds: ['libs/game/cup'],
    packages: [
      { folder: 'libs/game/cup', name: '@vers/cup', workspaceDependencies: ['@vers/saucer'] },
      { folder: 'libs/game/saucer', name: '@vers/saucer', workspaceDependencies: ['@vers/cup'] },
    ],
    reached: ['libs/game/cup', 'libs/game/saucer'],
  },
  {
    title: 'a seed folder with no package, as after its deletion',
    seeds: ['services/gone'],
    packages: [],
    reached: ['services/gone'],
  },
  {
    title: 'no folder for a dependency outside the scanned folders',
    seeds: ['services/kettle'],
    packages: [
      {
        folder: 'services/kettle',
        name: '@vers/service-kettle',
        workspaceDependencies: ['@vers/elsewhere'],
      },
    ],
    reached: ['services/kettle'],
  },
])('it reaches $title', (row) => {
  expect(collectReachedFolders(row.seeds, row.packages)).toStrictEqual([...row.reached]);
});
