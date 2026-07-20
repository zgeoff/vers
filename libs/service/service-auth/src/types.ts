export type ServiceName =
  | 'activity'
  | 'avatar'
  | 'email'
  | 'keys'
  | 'replay'
  | 'session'
  | 'user'
  | 'verification';

export type ServiceAudience = `service-${ServiceName}`;

export type TokenIssuer = 'app-web' | 'service-activity' | 'service-replay';
