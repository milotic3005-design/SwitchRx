// Fetch wrapper with a hard timeout. The infusion-copilot pipeline awaits the
// pharmacy lookup BEFORE it starts streaming the consult brief, so any hung
// external API (openFDA) would otherwise block the entire brief indefinitely —
// the user would be stuck on "Analyzing Scenario…" with no recovery. An
// AbortController-backed timeout guarantees every external call resolves (or
// rejects) within a bounded window so the pipeline always degrades gracefully.

const DEFAULT_TIMEOUT_MS = 8000;

export const fetchWithTimeout = async (
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};
