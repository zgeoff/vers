export type ServiceName = 'activity' | 'avatar' | 'email' | 'session' | 'user' | 'verification';

export type ServiceAudience = `service-${ServiceName}`;
