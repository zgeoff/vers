import { expect, test } from 'bun:test';
import { toFlagEnvVar } from './to-flag-env-var';

test('it prefixes and screaming-snakes a flag key into its env var name', () => {
  expect(toFlagEnvVar('market')).toBe('FEATURE_MARKET');
});
