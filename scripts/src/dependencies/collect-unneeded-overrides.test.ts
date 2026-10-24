import { expect, test } from 'bun:test';
import { collectUnneededOverrides } from './collect-unneeded-overrides';

test('it reports an override that every dependent range already admits', () => {
  expect(
    collectUnneededOverrides({
      overrides: { 'left-pad': '1.3.1' },
      catalog: {},
      dependents: [
        { dependent: 'pad-tools@2.0.0', name: 'left-pad', range: '^1.3.0' },
        { dependent: 'text-kit@4.1.0', name: 'left-pad', range: '>=1.0.0' },
      ],
    }),
  ).toStrictEqual([
    {
      entry: 'left-pad',
      problem: 'every range in bun.lock already admits 1.3.1, so the override changes nothing',
    },
  ]);
});

test('it keeps an override that a dependent range excludes', () => {
  expect(
    collectUnneededOverrides({
      overrides: { 'left-pad': '1.3.1' },
      catalog: {},
      dependents: [
        { dependent: 'pad-tools@2.0.0', name: 'left-pad', range: '^1.3.0' },
        { dependent: 'text-kit@4.1.0', name: 'left-pad', range: '1.2.0' },
      ],
    }),
  ).toStrictEqual([]);
});

test('it keeps an override that pins the catalog version for its dependents', () => {
  expect(
    collectUnneededOverrides({
      overrides: { 'left-pad': '1.3.1' },
      catalog: { 'left-pad': '1.3.1' },
      dependents: [{ dependent: 'pad-tools@2.0.0', name: 'left-pad', range: '^1.3.0' }],
    }),
  ).toStrictEqual([]);
});

test('it reports an override that differs from the catalog version and changes nothing', () => {
  expect(
    collectUnneededOverrides({
      overrides: { 'left-pad': '1.3.1' },
      catalog: { 'left-pad': '1.3.0' },
      dependents: [{ dependent: 'pad-tools@2.0.0', name: 'left-pad', range: '^1.3.0' }],
    }),
  ).toStrictEqual([
    {
      entry: 'left-pad',
      problem: 'every range in bun.lock already admits 1.3.1, so the override changes nothing',
    },
  ]);
});

test('it reports an override of a package that nothing depends on', () => {
  expect(
    collectUnneededOverrides({
      overrides: { 'left-pad': '1.3.1' },
      catalog: {},
      dependents: [{ dependent: 'pad-tools@2.0.0', name: 'right-pad', range: '^1.3.0' }],
    }),
  ).toStrictEqual([
    { entry: 'left-pad', problem: 'no package in bun.lock depends on the overridden package' },
  ]);
});
