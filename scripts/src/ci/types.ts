export interface WorkflowJob {
  needs: Array<string>;
  condition: string;
  cancelsInProgress: boolean;
}

export interface RunAfterCancelledNeed {
  job: string;
  cancelledJob: string;
}

export interface RunLookup {
  apiURL: string;
  repository: string;
  runID: string;
  token: string;
}

export interface SkipAfterTimedOutNeed {
  job: string;
  timedOutJob: string;
}
