import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ClientMessageType } from '../types';
import { createSetActivityMessage } from './create-set-activity-message';

test('it creates a set activity message carrying the server-authored row', () => {
  const activity = createMockActivityData();
  const message = createSetActivityMessage(activity);

  expect(message).toStrictEqual({ activity, type: ClientMessageType.SetActivity });
});
