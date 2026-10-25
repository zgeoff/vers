import { isTerminalCheckpointType } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { match } from 'ts-pattern';
import type {
  CallOutcome,
  ModelActivity,
  ModelCall,
  ModelChain,
  SettlementDevice,
  SettlementModel,
} from './types';

interface ModelAfterCall {
  readonly model: SettlementModel;
  readonly outcome: CallOutcome;
}

export function buildModelAfterCall(
  model: Readonly<SettlementModel>,
  call: Readonly<ModelCall>,
): ModelAfterCall {
  const current = model.activities.at(-1);

  invariant(current, 'a call always targets the latest activity');

  return match(call)
    .with({ kind: 'deliver' }, (delivery) => buildAfterDelivery(model, current, delivery))
    .with({ kind: 'stop' }, (stop) => buildAfterStop(model, current, stop.device))
    .with({ kind: 'takeover' }, (takeover) => {
      if (current.status !== 'active') {
        return { model, outcome: { code: 'NOT_FOUND', kind: 'refused' } } as const;
      }

      return {
        model: replaceActivity(model, { ...current, writer: takeover.device }),
        outcome: { kind: 'accepted' },
      } as const;
    })
    .exhaustive();
}

function buildAfterDelivery(
  model: Readonly<SettlementModel>,
  current: Readonly<ModelActivity>,
  delivery: Readonly<Extract<ModelCall, { kind: 'deliver' }>>,
): ModelAfterCall {
  if (current.status !== 'active') {
    const isSettledResend =
      delivery.lastVersion === current.appendedHead && delivery.expectedHead < delivery.lastVersion;

    return {
      model,
      outcome: isSettledResend
        ? { kind: 'accepted' }
        : { code: 'ACTIVITY_TERMINAL', kind: 'refused' },
    };
  }

  if (isOtherWriter(current, delivery.device)) {
    return { model, outcome: { code: 'SESSION_EVICTED', kind: 'refused' } };
  }

  if (delivery.expectedHead !== current.appendedHead) {
    return { model, outcome: { code: 'CONFLICT', kind: 'refused' } };
  }

  const last = current.checkpoints[delivery.lastVersion - 1];

  invariant(last, 'a delivery never reaches past the stream it was cut from');

  const appended: ModelActivity = {
    ...current,
    appendedHead: delivery.lastVersion,
    tamperedVersion: current.tamperedVersion ?? (delivery.forged ? delivery.lastVersion : null),
    writer: delivery.device,
  };

  if (!isTerminalCheckpointType(last.type)) {
    return { model: replaceActivity(model, appended), outcome: { kind: 'accepted' } };
  }

  return {
    model: buildAfterForwardExit(model, { ...appended, status: 'stopped' }),
    outcome: { kind: 'accepted' },
  };
}

function isOtherWriter(activity: Readonly<ModelActivity>, device: SettlementDevice): boolean {
  return activity.writer !== null && activity.writer !== device;
}

function replaceActivity(
  model: Readonly<SettlementModel>,
  replacement: Readonly<ModelActivity>,
): SettlementModel {
  return {
    ...model,
    activities: model.activities.map((activity) =>
      activity.id === replacement.id ? replacement : activity,
    ),
  };
}

function buildAfterForwardExit(
  model: Readonly<SettlementModel>,
  exited: Readonly<ModelActivity>,
): SettlementModel {
  const tail = exited.checkpoints[exited.appendedHead - 1];
  const withActivity = replaceActivity(model, exited);

  if (tail === undefined || tail.type === 'started') {
    return withActivity;
  }

  const anchored = withActivity.chains.find(
    (chain) =>
      chain.scopeID === exited.scopeID && chain.appendedChainIndex === exited.startChainIndex,
  );

  if (anchored === undefined) {
    return withActivity;
  }

  const moved: ModelChain = {
    ...anchored,
    appendedChainIndex: exited.startChainIndex + exited.appendedHead,
  };

  return {
    ...withActivity,
    chains: withActivity.chains.map((chain) => (chain === anchored ? moved : chain)),
  };
}

function buildAfterStop(
  model: Readonly<SettlementModel>,
  current: Readonly<ModelActivity>,
  device: SettlementDevice,
): ModelAfterCall {
  if (current.status !== 'active') {
    return { model, outcome: { kind: 'accepted' } };
  }

  if (isOtherWriter(current, device)) {
    return { model, outcome: { code: 'SESSION_EVICTED', kind: 'refused' } };
  }

  return {
    model: buildAfterForwardExit(model, { ...current, status: 'stopped' }),
    outcome: { kind: 'accepted' },
  };
}
