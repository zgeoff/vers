export type StackServiceName =
  | 'activity'
  | 'avatar'
  | 'email'
  | 'keys'
  | 'replay'
  | 'session'
  | 'user'
  | 'verification';

export interface StackPorts {
  readonly web: number;
  readonly resend: number;
  readonly umami: number;
  readonly services: Readonly<Record<StackServiceName, number>>;
}
