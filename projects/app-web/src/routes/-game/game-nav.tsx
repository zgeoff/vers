import { Link } from '@tanstack/react-router';
import { Icon, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { setNavigationVisible } from '../../state/set-navigation-visible';
import { toggleNavigationVisible } from '../../state/toggle-navigation-visible';
import { useNavigationVisible } from '../../state/use-navigation-visible';

interface GameNavLink {
  readonly Icon: typeof Icon.Respite;
  readonly label: string;
  readonly to:
    | '/account'
    | '/avatar'
    | '/encounter'
    | '/explore'
    | '/market'
    | '/respite'
    | '/stash';
}

const GAME_NAV_LINKS: ReadonlyArray<GameNavLink> = [
  { Icon: Icon.Respite, label: 'Respite', to: '/respite' },
  { Icon: Icon.Explore, label: 'Explore', to: '/explore' },
  { Icon: Icon.Stash, label: 'Stash', to: '/stash' },
  { Icon: Icon.Market, label: 'Market', to: '/market' },
  { Icon: Icon.Encounter, label: 'Encounter', to: '/encounter' },
  { Icon: Icon.Avatar, label: 'Avatar', to: '/avatar' },
  { Icon: Icon.Account, label: 'Account', to: '/account' },
];

const navList = css({ display: 'flex', flexDirection: 'column', gap: '2' });

export function GameNav() {
  const isVisible = useNavigationVisible();

  return (
    <div>
      <button aria-expanded={isVisible} type="button" onClick={toggleNavigationVisible}>
        <Icon.Menu />
        <Text>Menu</Text>
      </button>
      {isVisible && (
        <nav className={navList}>
          {GAME_NAV_LINKS.map((link) => (
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
