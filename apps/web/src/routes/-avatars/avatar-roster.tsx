import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import type { AvatarData } from '@vers/contract-avatar';
import { AVATAR_MODE_CAP } from '@vers/contract-avatar';
import { Heading, Text } from '@vers/design-system';
import { readPendingStartIntent } from '@vers/idle-client';
import { css, cx } from '@vers/styled-system/css';
import { useState } from 'react';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { avatarSelect } from './avatar-select';
import { findOngoingRunOwner } from './find-ongoing-run-owner';
import type { AvatarSelectResult } from './types';

const screen = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  padding: '8',
});

const grid = css({
  display: 'grid',
  gap: '4',
  gridTemplateColumns: '[repeat(auto-fill,minmax(12rem,1fr))]',
  width: 'full',
});

const card = css({
  alignItems: 'flex-start',
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: 'lg',
  borderWidth: '[1px]',
  color: 'text.primary',
  cursor: '[pointer]',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  minHeight: 'tileMin',
  padding: '5',
  textAlign: 'left',
  transitionDuration: 'fast',
  transitionProperty: '[border-color]',
  _hover: { borderColor: 'border.strong' },
});

const activeCard = css({ borderColor: 'border.strong' });

const createSlot = css({
  alignItems: 'center',
  borderColor: 'border.strong',
  borderRadius: 'lg',
  borderStyle: '[dashed]',
  borderWidth: '[1px]',
  color: 'text.muted',
  cursor: '[pointer]',
  display: 'flex',
  justifyContent: 'center',
  minHeight: 'tileMin',
  padding: '5',
  transitionDuration: 'fast',
  transitionProperty: '[color, border-color]',
  _hover: { borderColor: 'border.strong', color: 'text.primary' },
});

const cardName = css({ fontSize: 'lg', fontWeight: 'semibold' });
const cardMeta = css({ color: 'text.muted', fontSize: 'sm' });
const cardActiveMark = css({ color: 'text.primary', fontSize: 'sm' });

const rejection = css({
  borderColor: 'border.danger',
  borderWidth: '[1px]',
  color: 'text.danger',
  fontSize: 'sm',
  padding: '3',
});

interface AvatarRosterProps {
  readonly roster: {
    readonly activeAvatarID: null | string;
    readonly avatars: ReadonlyArray<AvatarData>;
  };
}

/**
 * The roster sheet: pick an avatar to persist as active and enter the game as, or take the empty
 * slot to create one. A selection a live activity rejects renders inline, naming the run's owner.
 */
export function AvatarRoster(props: AvatarRosterProps) {
  const avatarSelectFn = useServerFn(avatarSelect);
  const queryClient = useQueryClient();
  const handle = useIdleWorkerHandle();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<null | string>(null);

  const handleSelect = async (avatarID: string) => {
    setIsPending(true);
    setMessage(null);

    const pendingIntent = await readPendingStartIntent();

    const owner = findOngoingRunOwner(handle.avatar, pendingIntent, props.roster.avatars);

    if (owner !== null && owner.id !== avatarID) {
      setMessage(`${owner.name} is out on an activity — finish or stop it to switch`);
      setIsPending(false);

      return;
    }

    try {
      // a successful pick ends in a redirect that useServerFn already navigated to, resolving
      // this call with no value
      const result: AvatarSelectResult | undefined = await avatarSelectFn({ data: { avatarID } });

      if (result === undefined) {
        // the selection changed server-side; the cached roster still names the previous avatar
        // until it refetches
        void queryClient.invalidateQueries({
          queryKey: buildActiveAvatarQueryOptions().queryKey,
        });

        return;
      }

      const rejectionMessage =
        result.status === 'activity-locked'
          ? `${result.owningAvatarName} is out on an activity — finish or stop it to switch`
          : 'Something went wrong selecting that avatar';

      setMessage(rejectionMessage);
    } catch {
      setMessage('Something went wrong selecting that avatar');
    } finally {
      setIsPending(false);
    }
  };

  const isAtCap = (['trade', 'self_found'] as const).every(
    (mode) =>
      props.roster.avatars.filter((avatar) => avatar.mode === mode).length >= AVATAR_MODE_CAP,
  );

  return (
    <main className={screen}>
      <Heading level={1}>Choose your avatar</Heading>
      {message !== null && (
        <Text className={rejection} role="alert">
          {message}
        </Text>
      )}
      <div className={grid}>
        {props.roster.avatars.map((avatar) => {
          const isActive = avatar.id === props.roster.activeAvatarID;

          return (
            <button
              key={avatar.id}
              className={cx(card, isActive && activeCard)}
              disabled={isPending}
              type="button"
              onClick={() => {
                void handleSelect(avatar.id);
              }}
            >
              <span className={cardName}>{avatar.name}</span>
              <span className={cardMeta}>
                Level {avatar.level} · {avatar.mode === 'self_found' ? 'Self-Found' : 'Trade'}
              </span>
              {isActive && <span className={cardActiveMark}>Active</span>}
            </button>
          );
        })}
        {!isAtCap && (
          <Link className={createSlot} to="/avatars/create">
            <Text>+ Create avatar</Text>
          </Link>
        )}
      </div>
    </main>
  );
}
