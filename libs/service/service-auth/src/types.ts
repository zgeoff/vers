export type ServiceName = 'avatar' | 'email' | 'session' | 'user' | 'verification';

export type ServiceAudience = `service-${ServiceName}`;
