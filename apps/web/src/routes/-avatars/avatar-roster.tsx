import { Link } from '@tanstack/react-router';
import type { AvatarData } from '@vers/contract-avatar';
import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

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
  minHeight: '[9rem]',
  padding: '5',
  transitionDuration: 'fast',
  transitionProperty: '[border-color]',
  _hover: { borderColor: 'border.strong' },
});

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
  minHeight: '[9rem]',
  padding: '5',
  transitionDuration: 'fast',
  transitionProperty: '[color, border-color]',
  _hover: { borderColor: 'border.strong', color: 'text.primary' },
});

const cardName = css({ fontSize: 'lg', fontWeight: 'semibold' });
const cardMeta = css({ color: 'text.muted', fontSize: 'sm' });

/**
 * The pre-shell roster: pick an avatar to enter the game as, or take the empty slot to create one.
 */
export function AvatarRoster(props: Readonly<{ avatars: ReadonlyArray<AvatarData> }>) {
  return (
    <main className={screen}>
      <Heading level={1}>Choose your avatar</Heading>
      <div className={grid}>
        {props.avatars.map((avatar) => (
          <Link key={avatar.id} className={card} to="/explore">
            <span className={cardName}>{avatar.name}</span>
            <span className={cardMeta}>
              Level {avatar.level} · {avatar.mode === 'self_found' ? 'Self-Found' : 'Trade'}
            </span>
          </Link>
        ))}
        <Link className={createSlot} to="/avatars/create">
          <Text>+ Create avatar</Text>
        </Link>
      </div>
    </main>
  );
}
