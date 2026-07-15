import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { ActivityProgressNotice } from './activity-progress-notice';

test('it renders nothing with no activity running', async () => {
  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker: undefined,
    },
    () => {
      const rendered = render(<ActivityProgressNotice />);

      expect(rendered.container).toBeEmptyDOMElement();
    },
  );
});

test('it shows the activity name, wave progress, and running xp', async () => {
  await withIdleWorkerHandle(
    {
      activity: createMockActivitySnapshot({
        name: 'World Map Encounter',
        rewards: { xp: 42 },
        waves: [
          { enemies: [], id: 'wave_1' },
          { enemies: [], id: 'wave_2' },
          { enemies: [], id: 'wave_3' },
        ],
        wavesRemaining: 1,
      }),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker: undefined,
    },
    () => {
      render(<ActivityProgressNotice />);

      const notice = screen.getByTestId('activity-progress-notice');

      expect(notice).toHaveTextContent('World Map Encounter');
      expect(notice).toHaveTextContent('Wave 2 of 3');
      expect(notice).toHaveTextContent('+42 XP');
    },
  );
});
