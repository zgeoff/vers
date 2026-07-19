import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';

const chip = css({
  alignItems: 'center',
  backgroundColor: 'bg.panel',
  borderColor: 'border.strong',
  borderRadius: 'full',
  borderWidth: '[1px]',
  color: 'text.primary',
  cursor: '[pointer]',
  display: 'flex',
  fontSize: 'lg',
  fontWeight: 'semibold',
  height: '[3.5rem]',
  justifyContent: 'center',
  transitionDuration: 'fast',
  transitionProperty: '[color, border-color]',
  width: '[3.5rem]',
  _hover: { borderColor: 'text.primary' },
});

/**
 * The rail's identity anchor: the active avatar opens the switcher, or an empty chip opens the
 * create sheet when the account has none.
 */
export function AvatarChip() {
  const query = useQuery(buildActiveAvatarQueryOptions());
  const avatar = query.data;

  if (avatar) {
    return (
      <Link aria-label={`Switch avatar (${avatar.name})`} className={chip} to="/avatars">
        {avatar.name.slice(0, 1).toUpperCase()}
      </Link>
    );
  }

  return (
    <Link aria-label="Create avatar" className={chip} to="/avatars/create">
      +
    </Link>
  );
}
