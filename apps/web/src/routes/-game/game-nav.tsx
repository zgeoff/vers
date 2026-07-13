import { Link, useRouteContext } from '@tanstack/react-router';
import { Icon, Text } from '@vers/design-system';
import type { FlagKey } from '@vers/flags';
import { css } from '@vers/styled-system/css';
import { setNavigationVisible } from '../../state/set-navigation-visible';
import { toggleNavigationVisible } from '../../state/toggle-navigation-visible';
import { useNavigationVisible } from '../../state/use-navigation-visible';

interface GameNavLink {
  readonly Icon: typeof Icon.Respite;
  readonly flag?: FlagKey;
  readonly label: string;
  readonly to:
    | '/account'
    | '/activity'
    | '/avatar'
    | '/explore'
    | '/market'
    | '/respite'
    | '/stash';
}

const GAME_NAV_LINKS: ReadonlyArray<GameNavLink> = [
  { Icon: Icon.Respite, label: 'Respite', to: '/respite' },
  { Icon: Icon.Explore, label: 'Explore', to: '/explore' },
  { Icon: Icon.Stash, label: 'Stash', to: '/stash' },
  { Icon: Icon.Market, flag: 'market', label: 'Market', to: '/market' },
  { Icon: Icon.Encounter, label: 'Activity', to: '/activity' },
  { Icon: Icon.Avatar, label: 'Avatar', to: '/avatar' },
  { Icon: Icon.Account, label: 'Account', to: '/account' },
];

const navList = css({ display: 'flex', flexDirection: 'column', gap: '2' });

export function GameNav() {
  const isVisible = useNavigationVisible();
  const routeContext = useRouteContext({ from: '/_game' });
  const links = GAME_NAV_LINKS.filter((link) => !link.flag || routeContext.flags[link.flag]);

  return (
    <div>
      <button aria-expanded={isVisible} type="button" onClick={toggleNavigationVisible}>
        <Icon.Menu />
        <Text>Menu</Text>
      </button>
      {isVisible && (
        <nav className={navList}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => {
                setNavigationVisible(false);
              }}
            >
              <link.Icon />
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
