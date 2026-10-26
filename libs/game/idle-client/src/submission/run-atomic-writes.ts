interface WriteTransaction {
  readonly abort: () => void;
  readonly done: Promise<void>;
}

export async function runAtomicWrites(
  tx: Readonly<WriteTransaction>,
  writes: ReadonlyArray<() => Promise<unknown>>,
): Promise<void> {
  const issued: Array<Promise<unknown>> = [];

  try {
    for (const write of writes) {
      issued.push(write());
    }
  } catch (error) {
    // a request that throws as it is issued, such as a value the structured clone refuses, leaves
    // the transaction live, so it would still commit the requests issued before it
    tx.abort();

    await Promise.allSettled([...issued, tx.done]);

    throw error;
  }

  await Promise.all([...issued, tx.done]);
}
