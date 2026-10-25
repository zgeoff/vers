import { isTerminalCheckpointType } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { buildPrefixXP } from './build-prefix-xp';
import type { IterationOutcome, ModelActivity, ModelChain, SettlementModel } from './types';

interface ModelAfterIteration {
  readonly model: SettlementModel;
  readonly outcome: IterationOutcome;
}

export function buildModelAfterIteration(model: Readonly<SettlementModel>): ModelAfterIteration {
  const claimable = model.activities.filter(
    (activity) =>
      activity.status !== 'rejected' &&
      activity.appendedHead > activity.verifiedHead &&
      isPredecessorSettled(model, activity),
  );

  // one avatar's activities form one predecessor line, so only its first unsettled run is claimable
  invariant(claimable.length <= 1, 'the model never holds two claimable activities');

  const [claimed] = claimable;

  if (claimed === undefined) {
    return { model, outcome: 'idle' };
  }

  const caughtUp = buildChainCaughtUp(model, claimed);
  const chain = getChain(caughtUp, claimed.scopeID);

  if (claimed.verifiedHead === 0) {
    const isSeedAnchored =
      claimed.startChainIndex === 0 || chain.verifiedChainIndex === claimed.startChainIndex;

    if (!isSeedAnchored || claimed.buildXP !== caughtUp.avatarXP) {
      return { model: buildRejected(caughtUp, claimed), outcome: 'claimed' };
    }
  }

  const isTampered =
    claimed.tamperedVersion !== null &&
    claimed.tamperedVersion > claimed.verifiedHead &&
    claimed.tamperedVersion <= claimed.appendedHead;

  if (isTampered) {
    return { model: buildRejected(caughtUp, claimed), outcome: 'claimed' };
  }

  return { model: buildSettled(caughtUp, claimed), outcome: 'claimed' };
}

// an earlier activity the verifier proved part of was itself claimed in order, so the walk back
// stops there, while one it never proved says nothing about the activities before it
function isPredecessorSettled(
  model: Readonly<SettlementModel>,
  activity: Readonly<ModelActivity>,
): boolean {
  if (activity.predecessorID === null) {
    return true;
  }

  const predecessor = model.activities.find((candidate) => candidate.id === activity.predecessorID);

  invariant(predecessor, 'a predecessor is always an earlier activity of the same avatar');

  const isSettled =
    predecessor.status === 'rejected' || predecessor.verifiedHead >= predecessor.appendedHead;

  if (!isSettled) {
    return false;
  }

  return predecessor.verifiedHead > 0 || isPredecessorSettled(model, predecessor);
}

function buildChainCaughtUp(
  model: Readonly<SettlementModel>,
  claimed: Readonly<ModelActivity>,
): SettlementModel {
  const chain = getChain(model, claimed.scopeID);

  if (claimed.startChainIndex <= chain.verifiedChainIndex) {
    return model;
  }

  const exited = model.activities.find(
    (activity) =>
      activity.scopeID === claimed.scopeID &&
      activity.startChainIndex === chain.verifiedChainIndex &&
      activity.status === 'stopped' &&
      activity.appendedHead > 0 &&
      activity.verifiedHead === activity.appendedHead &&
      activity.checkpoints[activity.appendedHead - 1]?.type !== 'started',
  );

  if (exited === undefined) {
    return model;
  }

  return replaceChain(model, {
    ...chain,
    verifiedChainIndex: exited.startChainIndex + exited.appendedHead,
  });
}

function getChain(model: Readonly<SettlementModel>, scopeID: string): ModelChain {
  const chain = model.chains.find((candidate) => candidate.scopeID === scopeID);

  invariant(chain, 'every activity starts on a chain the model holds');

  return chain;
}

function replaceChain(
  model: Readonly<SettlementModel>,
  replacement: Readonly<ModelChain>,
): SettlementModel {
  return {
    ...model,
    chains: model.chains.map((chain) =>
      chain.scopeID === replacement.scopeID ? replacement : chain,
    ),
  };
}

function buildRejected(
  model: Readonly<SettlementModel>,
  claimed: Readonly<ModelActivity>,
): SettlementModel {
  const before = getChain(model, claimed.scopeID);
  const provedTail = claimed.checkpoints[claimed.verifiedHead - 1];
  const provedIndex = claimed.startChainIndex + claimed.verifiedHead;

  const chain =
    provedTail !== undefined && provedTail.type !== 'started'
      ? { ...before, verifiedChainIndex: Math.max(before.verifiedChainIndex, provedIndex) }
      : before;

  const rewound = replaceChain(model, { ...chain, appendedChainIndex: chain.verifiedChainIndex });

  return {
    ...rewound,
    activities: rewound.activities.map((activity) => {
      const isVoided =
        activity.id === claimed.id ||
        (activity.scopeID === claimed.scopeID &&
          activity.status !== 'rejected' &&
          activity.startChainIndex > chain.verifiedChainIndex);

      return isVoided ? toRejected(activity) : activity;
    }),
  };
}

function toRejected(activity: Readonly<ModelActivity>): ModelActivity {
  return { ...activity, status: 'rejected' };
}

function buildSettled(
  model: Readonly<SettlementModel>,
  claimed: Readonly<ModelActivity>,
): SettlementModel {
  const settledXP = buildPrefixXP(claimed.checkpoints, claimed.appendedHead);
  const segment = claimed.checkpoints.slice(claimed.verifiedHead, claimed.appendedHead);
  const tail = segment.at(-1);

  invariant(tail, 'a claimed activity always has an unverified checkpoint');

  const minted = segment.flatMap((checkpoint) =>
    checkpoint.rewardOrdinals.map(
      (ordinal) =>
        `${claimed.scopeID}:${claimed.startChainIndex + checkpoint.entry.version}:${ordinal}`,
    ),
  );

  const isForwardExited =
    tail.type !== 'started' &&
    (isTerminalCheckpointType(tail.type) || claimed.status === 'stopped');

  const chain = getChain(model, claimed.scopeID);
  const exitIndex = claimed.startChainIndex + claimed.appendedHead;

  const withChain =
    isForwardExited && exitIndex > chain.verifiedChainIndex
      ? replaceChain(model, { ...chain, verifiedChainIndex: exitIndex })
      : model;

  return {
    ...withChain,
    activities: withChain.activities.map((activity) =>
      activity.id === claimed.id
        ? { ...activity, settledXP, verifiedHead: claimed.appendedHead }
        : activity,
    ),
    avatarXP: Math.max(0, withChain.avatarXP + settledXP - claimed.settledXP),
    grants:
      tail.type === 'completed'
        ? [...new Set([...withChain.grants, claimed.scopeID])].toSorted()
        : withChain.grants,
    items: [...new Set([...withChain.items, ...minted])].toSorted(),
  };
}
