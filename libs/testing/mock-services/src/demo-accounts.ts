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
  {
    avatarName: 'Analytics Test Avatar',
    email: 'e2e-analytics@vers.test',
    name: 'Analytics Demo Account',
    password: 'password123',
    username: 'e2e-analytics',
  },

  // the device-state specs read the writer worker through the QA debug hook, which app-web
  // installs only for an address under the QA domain
  {
    avatarName: 'Reload Test Avatar',
    email: 'e2e-device-reload@qa.versidle.com',
    name: 'Device Reload Demo Account',
    password: 'password123',
    username: 'e2e-device-reload',
  },
  {
    avatarName: 'Second Tab Test Avatar',
    email: 'e2e-device-tab@qa.versidle.com',
    name: 'Device Second Tab Demo Account',
    password: 'password123',
    username: 'e2e-device-tab',
  },
  {
    avatarName: 'Takeover Test Avatar',
    email: 'e2e-device-takeover@qa.versidle.com',
    name: 'Device Takeover Demo Account',
    password: 'password123',
    username: 'e2e-device-takeover',
  },
  {
    avatarName: 'Offline Play Test Avatar',
    email: 'e2e-offline-play@qa.versidle.com',
    name: 'Offline Play Demo Account',
    password: 'password123',
    username: 'e2e-offline-play',
  },
];
