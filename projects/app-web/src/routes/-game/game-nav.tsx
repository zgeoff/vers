import { Link } from '@tanstack/react-router';
import { Icon, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { setNavigationVisible } from '../../state/set-navigation-visible';
import { toggleNavigationVisible } from '../../state/toggle-navigation-visible';
import { useNavigationVisible } from '../../state/use-navigation-visible';

interface GameNavLink {
  readonly Icon: typeof Icon.Nexus;
  readonly label: string;
  readonly to: '/account' | '/aether' | '/avatar' | '/nexus';
}

const GAME_NAV_LINKS: ReadonlyArray<GameNavLink> = [
  { Icon: Icon.Nexus, label: 'Nexus', to: '/nexus' },
  { Icon: Icon.Aether, label: 'Aether', to: '/aether' },
  { Icon: Icon.Avatar, label: 'Avatar', to: '/avatar' },
  { Icon: Icon.Account, label: 'Account', to: '/account' },
];

const navList = css({ display: 'flex', flexDirection: 'column', gap: '2' });

/**
 * The game chrome's collapsible side navigation: the visibility store ports as-is from the
 * pre-rebuild app, gating a plain list of links between the game's own routes.
 */
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
