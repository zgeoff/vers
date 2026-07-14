export type ServiceName =
  | 'activity'
  | 'avatar'
  | 'email'
  | 'keys'
  | 'session'
  | 'user'
  | 'verification';

export type ServiceAudience = `service-${ServiceName}`;
