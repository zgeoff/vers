export interface DemoAccount {
  readonly avatarName: null | string;
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly username: string;
}

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
  {
    avatarName: 'Drag Pan Test Avatar',
    email: 'e2e-drag-pan@vers.test',
    name: 'Drag Pan Demo Account',
    password: 'password123',
    username: 'e2e-drag-pan',
  },
];
