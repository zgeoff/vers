export interface DevToolsTarget {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl?: string;
}

export interface CDPEvent {
  readonly method: string;
  readonly params: unknown;
}

export interface SendOptions {
  readonly timeoutMS?: number;
}

export interface CDPClient {
  readonly close: () => void;
  readonly closed: Promise<void>;
  readonly send: (
    method: string,
    params?: Readonly<Record<string, unknown>>,
    options?: SendOptions,
  ) => Promise<unknown>;
  readonly subscribe: (listener: (event: CDPEvent) => void) => () => void;
  readonly waitFor: (method: string, timeoutMS?: number) => Promise<unknown>;
}

export type CaptureEvent =
  | { readonly kind: 'attached'; readonly targetID: string }
  | { readonly kind: 'body'; readonly body: string; readonly url: string }
  | { readonly kind: 'detached'; readonly targetID: string }
  | { readonly kind: 'failure'; readonly reason: string; readonly url: string }
  | {
      readonly kind: 'request';
      readonly body: string;
      readonly method: string;
      readonly url: string;
    }
  | { readonly kind: 'response'; readonly status: number; readonly url: string };

interface ProfileCallFrame {
  readonly columnNumber: number;
  readonly functionName: string;
  readonly lineNumber: number;
  readonly url: string;
}

interface ProfileNode {
  readonly callFrame: ProfileCallFrame;
  readonly id: number;
}

export interface CPUProfile {
  readonly nodes: ReadonlyArray<ProfileNode>;
  readonly samples: ReadonlyArray<number>;
  readonly timeDeltas: ReadonlyArray<number>;
}

export interface KeyEvent {
  readonly code: string;
  readonly key: string;
  readonly text?: string;
  readonly type: 'keyDown' | 'keyUp';
  readonly windowsVirtualKeyCode?: number;
}
