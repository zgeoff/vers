interface LoadStackApp {
  readonly envName: string;
  readonly manifestApp: string;
  readonly retained: boolean;
}

export const LOAD_STACK_APPS: ReadonlyArray<LoadStackApp> = [
  { envName: 'VERS_APP_WEB', manifestApp: 'vers-app-web', retained: false },
  { envName: 'VERS_SERVICE_ACTIVITY', manifestApp: 'vers-service-activity', retained: false },
  { envName: 'VERS_SERVICE_KEYS', manifestApp: 'vers-service-keys', retained: false },
  { envName: 'VERS_SERVICE_REPLAY', manifestApp: 'vers-service-replay', retained: false },
  { envName: 'VERS_SERVICE_REPLAY_RETAINED', manifestApp: 'vers-service-replay', retained: true },
  { envName: 'VERS_SERVICE_SESSION', manifestApp: 'vers-service-session', retained: false },
];
