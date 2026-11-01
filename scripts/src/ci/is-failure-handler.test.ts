import { expect, test } from 'bun:test';
import { isFailureHandler } from './is-failure-handler';

test('it takes a job that runs only when a need fails for a failure handler', () => {
  expect(
    isFailureHandler({
      needs: ['bake', 'wash'],
      condition: "!cancelled() && needs.wash.result == 'failure'",
      cancelsInProgress: false,
    }),
  ).toBeTrue();
});

test('it takes a job that also runs when every need succeeds for no failure handler', () => {
  expect(
    isFailureHandler({ needs: ['bake'], condition: '!cancelled()', cancelsInProgress: false }),
  ).toBeFalse();
});

test('it takes a job that never runs on a failed need for no failure handler', () => {
  expect(
    isFailureHandler({ needs: ['bake'], condition: 'success()', cancelsInProgress: false }),
  ).toBeFalse();
});

test('it takes a job with no needs for no failure handler without reading its condition', () => {
  expect(
    isFailureHandler({
      needs: [],
      condition: "github.event_name != 'pull_request'",
      cancelsInProgress: false,
    }),
  ).toBeFalse();
});
