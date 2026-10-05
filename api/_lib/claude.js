// One place that calls the Claude API, shared by /api/chat and /api/panel.
// The Anthropic key only ever exists on the server (ANTHROPIC_API_KEY).
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './db.js';

const MODEL = 'claude-opus-5-5';
let client = null;

export async function ask({ system, messages, maxTokens = 4096 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'The desk is closed (no AI key configured).');
  client ??= new Anthropic();

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens, // a ceiling, not a target: thinking tokens count toward it
    output_config: { effort: 'low' },
    // If a reply is ever declined by a safety classifier, retry on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
  }).catch((err) => {
    console.error('[claude] error', err.status, err.message);
    throw new HttpError(502, 'The desk stepped out for a minute. Try again in a sec.');
  });

  if (response.stop_reason === 'refusal') throw new HttpError(422, "They won't touch that one. Ask something else.");
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'Lost the train of thought. Try again.');
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}
