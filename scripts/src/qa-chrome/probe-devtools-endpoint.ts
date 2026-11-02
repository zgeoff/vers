const PROBE_TIMEOUT_MS = 1000;

export async function probeDevToolsEndpoint(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}
