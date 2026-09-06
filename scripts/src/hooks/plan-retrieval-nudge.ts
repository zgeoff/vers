import { pickRetrievalKind } from './pick-retrieval-kind';
import type {
  RetrievalCall,
  RetrievalKind,
  RetrievalPhase,
  RetrievalPlan,
  RetrievalState,
} from './types';

// Consecutive content searches in the implement phase before a nudge.
const SEARCH_THRESHOLD = 3;

// Interleaved content searches and whole-file code reads in the implement phase before a nudge.
// The run needs at least HUNT_MIN_SEARCHES searches in it: reads alone never fire, and one search
// followed by reads is reading the results, not hunting for a definition.
const HUNT_THRESHOLD = 5;
const HUNT_MIN_SEARCHES = 2;

// Consecutive Serena symbol lookups in the research phase, with no file read between, before a nudge.
const LOOKUP_THRESHOLD = 3;

// After a nudge, nothing is counted or fired for this long; a reminder on every call is residue.
const COOLDOWN_MS = 120_000;

export const INITIAL_RETRIEVAL_STATE: RetrievalState = {
  phase: 'research',
  searchRun: 0,
  huntRun: 0,
  huntSearches: 0,
  lookupRun: 0,
  nudgedAt: 0,
  calls: 0,
};

export function planRetrievalNudge(
  state: RetrievalState,
  call: RetrievalCall,
  now: number,
): RetrievalPlan {
  const kind = pickRetrievalKind(call.toolName, call.toolInput);
  const planning = call.permissionMode === 'plan';
  const edited = kind === 'edit';
  const sessionPhase: RetrievalPhase = edited && !planning ? 'implement' : state.phase;
  const counted: RetrievalState = { ...state, phase: sessionPhase, calls: state.calls + 1 };

  if (now - state.nudgedAt < COOLDOWN_MS) {
    return { state: counted, nudge: null };
  }

  const phase: RetrievalPhase = planning ? 'research' : sessionPhase;

  const advanced =
    phase === 'implement' ? advanceImplement(counted, kind) : advanceResearch(counted, kind);

  const nudge =
    phase === 'implement' ? formatImplementNudge(advanced) : formatResearchNudge(advanced);

  if (nudge === null) {
    return { state: advanced, nudge: null };
  }

  return {
    state: { ...advanced, searchRun: 0, huntRun: 0, huntSearches: 0, lookupRun: 0, nudgedAt: now },
    nudge,
  };
}

function advanceImplement(state: RetrievalState, kind: RetrievalKind): RetrievalState {
  const base = { ...state, lookupRun: 0 };

  switch (kind) {
    case 'search': {
      return {
        ...base,
        searchRun: state.searchRun + 1,
        huntRun: state.huntRun + 1,
        huntSearches: state.huntSearches + 1,
      };
    }
    case 'read-whole': {
      return { ...base, searchRun: 0, huntRun: state.huntRun + 1 };
    }
    case 'symbol-lookup':
    case 'edit': {
      return { ...base, searchRun: 0, huntRun: 0, huntSearches: 0 };
    }
    case 'read-ranged':
    case 'other': {
      break;
    }
  }

  // A ranged read or any other call breaks a consecutive search run but leaves the hunt alone.
  return { ...base, searchRun: 0 };
}

function advanceResearch(state: RetrievalState, kind: RetrievalKind): RetrievalState {
  const base = { ...state, searchRun: 0, huntRun: 0, huntSearches: 0 };

  switch (kind) {
    case 'symbol-lookup': {
      return { ...base, lookupRun: state.lookupRun + 1 };
    }
    case 'read-whole':
    case 'read-ranged':
    case 'search':
    case 'edit': {
      return { ...base, lookupRun: 0 };
    }
    case 'other': {
      break;
    }
  }

  // Glob, Bash, and the like neither extend nor break a lookup run.
  return base;
}

function formatImplementNudge(state: RetrievalState): string | null {
  const hunting = state.huntRun >= HUNT_THRESHOLD && state.huntSearches >= HUNT_MIN_SEARCHES;

  if (state.searchRun < SEARCH_THRESHOLD && !hunting) {
    return null;
  }

  const seen =
    state.searchRun >= SEARCH_THRESHOLD
      ? `${state.searchRun} content searches in a row`
      : `${state.huntRun} content searches and whole-file reads in a row`;

  return [
    `Retrieval policy (implement phase): ${seen}.`,
    "For the next definition or caller lookup, Serena's find_symbol (include_body: true) or",
    'find_referencing_symbols returns the exact span, and get_symbols_overview outlines a file.',
    'Whole-file reads stay fine when you need the surrounding intent.',
  ].join(' ');
}

function formatResearchNudge(state: RetrievalState): string | null {
  if (state.lookupRun < LOOKUP_THRESHOLD) {
    return null;
  }

  return [
    `Retrieval policy (research phase): ${state.lookupRun} symbol lookups in a row with no file read.`,
    'Intent lives in comments and the surrounding code.',
    'Read the file, or the region around those symbols, before you draw a conclusion.',
  ].join(' ');
}
