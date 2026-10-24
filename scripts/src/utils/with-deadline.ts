interface Deadline {
  readonly afterMs: number;
  readonly label: string;
}

export async function withDeadline<T>(run: () => Promise<T>, deadline: Deadline): Promise<T> {
  const expiry = Promise.withResolvers<never>();

  const timer = setTimeout(() => {
    expiry.reject(new Error(`${deadline.label} did not finish within ${deadline.afterMs} ms`));
  }, deadline.afterMs);

  try {
    return await Promise.race([run(), expiry.promise]);
  } finally {
    clearTimeout(timer);
  }
}
