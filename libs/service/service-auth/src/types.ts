export type ServiceName =
  | 'activity'
  | 'avatar'
  | 'email'
  | 'keys'
  | 'replay'
  | 'session'
  | 'user'
  | 'verification';

export type AudienceName = ServiceName | 'replay-provider';

export type ServiceAudience = `service-${AudienceName}`;

export type TokenIssuer = 'app-web' | 'service-activity' | 'service-replay';
