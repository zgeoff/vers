export interface DemoAccount {
  readonly avatarName: null | string;
  readonly completedNodeIDs?: ReadonlyArray<string>;
  readonly email: string;
  readonly isQA?: boolean;
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
  {
    avatarName: 'Offline Engage Test Avatar',
    email: 'e2e-offline-engage@qa.versidle.com',
    name: 'Offline Engage Demo Account',
    password: 'password123',
    username: 'e2e-offline-engage',
  },
  {
    avatarName: 'Worker Online Test Avatar',
    email: 'e2e-worker-online@qa.versidle.com',
    name: 'Worker Online Demo Account',
    password: 'password123',
    username: 'e2e-worker-online',
  },
  {
    avatarName: 'Offline Reload Test Avatar',
    email: 'e2e-offline-reload@qa.versidle.com',
    name: 'Offline Reload Demo Account',
    password: 'password123',
    username: 'e2e-offline-reload',
  },
  {
    avatarName: 'Offline Switch Test Avatar',
    email: 'e2e-offline-switch@qa.versidle.com',
    name: 'Offline Switch Demo Account',
    password: 'password123',
    username: 'e2e-offline-switch',
  },
  {
    avatarName: 'Offline Opening Test Avatar',
    email: 'e2e-offline-opening@qa.versidle.com',
    name: 'Offline Opening Demo Account',
    password: 'password123',
    username: 'e2e-offline-opening',
  },
  {
    avatarName: 'Offline Stop Test Avatar',
    email: 'e2e-offline-stop@qa.versidle.com',
    name: 'Offline Stop Demo Account',
    password: 'password123',
    username: 'e2e-offline-stop',
  },
  {
    avatarName: 'Offline Build Test Avatar',

    // a cleared node beside the origin, so the player can switch nodes while a run plays
    completedNodeIDs: ['1_0'],
    email: 'e2e-offline-build@qa.versidle.com',
    name: 'Offline Build Demo Account',
    password: 'password123',
    username: 'e2e-offline-build',
  },
  {
    avatarName: 'Offline Refusal Test Avatar',
    email: 'e2e-offline-refusal@qa.versidle.com',
    name: 'Offline Refusal Demo Account',
    password: 'password123',
    username: 'e2e-offline-refusal',
  },
  {
    avatarName: 'Refusal Shown Test Avatar',
    email: 'e2e-refusal-shown@qa.versidle.com',
    name: 'Refusal Shown Demo Account',
    password: 'password123',
    username: 'e2e-refusal-shown',
  },
  {
    avatarName: 'Refusal Page Test Avatar',
    email: 'e2e-refusal-page@qa.versidle.com',
    name: 'Refusal Page Demo Account',
    password: 'password123',
    username: 'e2e-refusal-page',
  },
  {
    avatarName: 'Run End Shared Cut Test Avatar',
    email: 'e2e-run-end-shared-cut@qa.versidle.com',

    // the run plays to its end under the QA speed-up, which only a QA-flagged avatar takes
    isQA: true,
    name: 'Run End Shared Cut Demo Account',
    password: 'password123',
    username: 'e2e-run-end-shared-cut',
  },
  {
    avatarName: 'Run End Shared Midcut Test Avatar',
    email: 'e2e-run-end-shared-midcut@qa.versidle.com',

    // the run plays to its end under the QA speed-up, which only a QA-flagged avatar takes
    isQA: true,
    name: 'Run End Shared Midcut Demo Account',
    password: 'password123',
    username: 'e2e-run-end-shared-midcut',
  },
  {
    avatarName: 'Run End Locks Cut Test Avatar',
    email: 'e2e-run-end-locks-cut@qa.versidle.com',

    // the run plays to its end under the QA speed-up, which only a QA-flagged avatar takes
    isQA: true,
    name: 'Run End Locks Cut Demo Account',
    password: 'password123',
    username: 'e2e-run-end-locks-cut',
  },
  {
    avatarName: 'Run End Locks Midcut Test Avatar',
    email: 'e2e-run-end-locks-midcut@qa.versidle.com',

    // the run plays to its end under the QA speed-up, which only a QA-flagged avatar takes
    isQA: true,
    name: 'Run End Locks Midcut Demo Account',
    password: 'password123',
    username: 'e2e-run-end-locks-midcut',
  },
  {
    avatarName: 'Run End Chain Test Avatar',
    email: 'e2e-run-end-chain@qa.versidle.com',

    // the runs play out under the QA speed-up, which only a QA-flagged avatar takes
    isQA: true,
    name: 'Run End Chain Demo Account',
    password: 'password123',
    username: 'e2e-run-end-chain',
  },
];
