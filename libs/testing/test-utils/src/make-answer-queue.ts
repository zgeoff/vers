export function makeAnswerQueue<T>(answers: ReadonlyArray<T>): () => T {
  const remaining = answers.values();

  return () => {
    const next = remaining.next();

    if (next.done === true) {
      throw new Error(`the answer queue ran out after ${answers.length} answer(s)`);
    }

    return next.value;
  };
}
