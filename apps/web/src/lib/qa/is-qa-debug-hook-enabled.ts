interface QADebugHookGate {
  readonly nonProductionBuild: boolean;
  readonly qaAccount: boolean;
  readonly search: string;
}

export function isQADebugHookEnabled(gate: QADebugHookGate): boolean {
  return (
    gate.qaAccount ||
    (gate.nonProductionBuild && new URLSearchParams(gate.search).get('qa') === '1')
  );
}
