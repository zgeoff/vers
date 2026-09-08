import { expect, test } from 'bun:test';
import { isQADebugHookEnabled } from './is-qa-debug-hook-enabled';

test('it enables the hook for a QA account in any build', () => {
  expect(
    isQADebugHookEnabled({ nonProductionBuild: false, qaAccount: true, search: '' }),
  ).toBeTrue();
});

test('it enables the hook for ?qa=1 only in a non-production build', () => {
  expect(
    isQADebugHookEnabled({ nonProductionBuild: true, qaAccount: false, search: '?qa=1' }),
  ).toBeTrue();

  expect(
    isQADebugHookEnabled({ nonProductionBuild: false, qaAccount: false, search: '?qa=1' }),
  ).toBeFalse();
});

test('it keeps the hook off for a normal account with no flag', () => {
  expect(
    isQADebugHookEnabled({ nonProductionBuild: true, qaAccount: false, search: '?qa=0' }),
  ).toBeFalse();

  expect(
    isQADebugHookEnabled({ nonProductionBuild: false, qaAccount: false, search: '' }),
  ).toBeFalse();
});
