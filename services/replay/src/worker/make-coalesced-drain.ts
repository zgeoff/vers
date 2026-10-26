// a request that joins a drain in flight can carry work appended after that drain's last empty
// claim, so the drain runs once more, with the latest request's input, before any joined request
// resolves
export function makeCoalescedDrain<Input>(
  runDrain: (input: Input) => Promise<number>,
): (input: Input) => Promise<number> {
  let drainInFlight: Promise<number> | undefined;
  let requestedInput: { readonly input: Input } | undefined;

  const runRequestedDrains = async (): Promise<number> => {
    let claimed = 0;

    try {
      while (requestedInput !== undefined) {
        const request = requestedInput;

        requestedInput = undefined;

        claimed += await runDrain(request.input);
      }
    } finally {
      drainInFlight = undefined;
    }

    return claimed;
  };

  return (input) => {
    requestedInput = { input };
    drainInFlight ??= runRequestedDrains();

    return drainInFlight;
  };
}
