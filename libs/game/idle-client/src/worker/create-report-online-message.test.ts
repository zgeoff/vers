import { expect, test } from 'bun:test';
import { ClientMessageType } from '../types';
import { createReportOnlineMessage } from './create-report-online-message';

test('it creates a report online message', () => {
  const message = createReportOnlineMessage('avatar_1', true);

  expect(message).toStrictEqual({
    avatarID: 'avatar_1',
    claim: true,
    type: ClientMessageType.ReportOnline,
  });
});
