interface QADebugHookGate {
  readonly dev: boolean;
  readonly qaAccount: boolean;
  readonly search: string;
}

export function isQADebugHookEnabled(gate: QADebugHookGate): boolean {
  return gate.qaAccount || (gate.dev && new URLSearchParams(gate.search).get('qa') === '1');
}
