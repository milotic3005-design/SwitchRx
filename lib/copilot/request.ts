import type { ChatMessage } from '@/lib/ai';
import { COPILOT_DEPTH_ADDENDA, INFUSION_QA_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import type { CopilotTurn, Depth } from './types';

/** How many finished turns of earlier conversation the model sees. */
const HISTORY_TURNS = 6;

export interface CopilotRequest {
  system: string;
  messages: ChatMessage[];
  thinkingLevel: 'low' | 'high';
}

/** A turn is sent as context only if it finished (done or stopped) and has an answer. */
function isSendable(turn: CopilotTurn): boolean {
  return (turn.status === 'done' || turn.status === 'stopped') && turn.answer.trim() !== '';
}

/**
 * Builds the model request for one question: the Q&A system prompt, the depth
 * addendum and (when present) the verified FDA lookup context, followed by the
 * last six finished turns as user/assistant pairs and then the new question.
 */
export function buildCopilotRequest(args: {
  history: CopilotTurn[];
  question: string;
  depth: Depth;
  lookupContext: string;
}): CopilotRequest {
  const { history, question, depth, lookupContext } = args;

  const system =
    `${INFUSION_QA_SYSTEM_PROMPT}\n\n${COPILOT_DEPTH_ADDENDA[depth]}` +
    (lookupContext ? `\n\n---\n\n${lookupContext}` : '');

  const messages: ChatMessage[] = history
    .filter(isSendable)
    .slice(-HISTORY_TURNS)
    .flatMap((turn): ChatMessage[] => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]);
  messages.push({ role: 'user', content: question });

  return { system, messages, thinkingLevel: depth === 'thorough' ? 'high' : 'low' };
}
