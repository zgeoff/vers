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
