export async function runDrainLoop<TStep>(
  runStep: () => Promise<TStep | null>,
): Promise<Array<TStep>> {
  const steps: Array<TStep> = [];

  for (;;) {
    const step = await runStep();

    if (step === null) {
      return steps;
    }

    steps.push(step);
  }
}
