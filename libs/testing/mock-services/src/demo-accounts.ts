/**
 * One e2e demo account. The mock backend seeds it into its in-memory store and the full-stack
 * harness seeds it into postgres, so a spec's seeded login lands identically against either
 * backend. A non-null `avatarName` seeds one avatar for the account, enough for the shell's
 * active-avatar gate to admit it straight into the game rather than the roster; `null` leaves the
 * account avatarless.
 */
export interface DemoAccount {
  readonly avatarName: null | string;
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly username: string;
}

/**
 * The e2e demo accounts, single-sourced for both seed writers so adding or changing one is a
 * one-line edit in one place. Each signed-in spec logs in as its own account so their sessions
 * never collide across a shared server.
 */
export const DEMO_ACCOUNTS: ReadonlyArray<DemoAccount> = [
  {
    avatarName: 'Demo Test Avatar',
    email: 'demo@vers.test',
    name: 'Demo Account',
    password: 'password123',
    username: 'demo',
  },
  {
    avatarName: 'Game Test Avatar',
    email: 'e2e-game@vers.test',
    name: 'Game Demo Account',
    password: 'password123',
    username: 'e2e-game',
  },
  {
    avatarName: 'Canvas Test Avatar',
    email: 'e2e-canvas@vers.test',
    name: 'Canvas Demo Account',
    password: 'password123',
    username: 'e2e-canvas',
  },
  {
    avatarName: 'Satellite Test Avatar',
    email: 'e2e-avatar-satellite@vers.test',
    name: 'Avatar Satellite Demo Account',
    password: 'password123',
    username: 'e2e-avatar-satellite',
  },
  {
    avatarName: 'Web Locks Test Avatar',
    email: 'e2e-web-locks@vers.test',
    name: 'Web Locks Demo Account',
    password: 'password123',
    username: 'e2e-web-locks',
  },
  {
    avatarName: 'RosterPrime',
    email: 'e2e-avatar-roster@vers.test',
    name: 'Avatar Roster Demo Account',
    password: 'password123',
    username: 'e2e-avatar-roster',
  },
];
