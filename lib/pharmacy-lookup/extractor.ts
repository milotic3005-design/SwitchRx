// Drug-name + domain extractor. Calls the server-side classifier route, which
// uses Claude with a structured-output JSON schema so the response is
// guaranteed-shape JSON. Keeping it server-side means the API key never reaches
// the browser. This is the cheap first step in the lookup pipeline; the
// expensive consult-brief generation runs in parallel against the main scenario.

import type { QueryClassification } from './types';

export const classifyAndExtract = async (
  scenario: string,
): Promise<QueryClassification> => {
  const res = await fetch('/api/ai/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Classification failed (${res.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  return (await res.json()) as QueryClassification;
};
