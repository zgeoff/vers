import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createReportOnlineMessage } from './create-report-online-message';
import { isReportOnlineMessage } from './is-report-online-message';

test('it recognizes a report online message', () => {
  expect(isReportOnlineMessage(createReportOnlineMessage('avatar_1', false))).toBeTrue();
});

test('it rejects a message of another type', () => {
  expect(isReportOnlineMessage({ type: ClientMessageType.Initialize })).toBeFalse();
});
