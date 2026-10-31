export interface WorkflowJob {
  needs: Array<string>;
  condition: string;
  cancelsInProgress: boolean;
}

export interface RunAfterCancelledNeed {
  job: string;
  cancelledJob: string;
}
