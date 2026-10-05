// GET  /api/chat            -> recent chat history
// POST /api/chat {message}  -> talk to The Sharp
//
// The persona prompt and the Anthropic key only ever exist on the server.
import Anthropic from '@anthropic-ai/sdk';
import { db, handle, HttpError, unwrap } from './_lib/db.js';
import { requirePlayer, summarize } from './_lib/player.js';
import { findGame, getGames, SPORTS } from './_lib/odds.js';
import { findTeamId, getTeam } from './_lib/espn.js';
import { gameFile, PERSONA, playerFile } from './_lib/persona.js';

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGE_CHARS = 500;
const HISTORY_TURNS = 16;      // how many past messages Claude sees
const RATE_LIMIT_PER_MIN = 6;  // stops one tab from draining the API budget

let anthropic = null;

async function history(playerId, limit) {
  const rows = unwrap(
    await db().from('messages').select('role, content, created_at')
      .eq('player_id', playerId).order('id', { ascending: false }).limit(limit),
  );
  return rows.reverse();
}

export default handle({
  async GET(req) {
    const player = await requirePlayer(req);
    return { messages: await history(player.id, 50) };
  },

  async POST(req) {
    if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'Lou is off the clock (no AI key configured).');

    const player = await requirePlayer(req);
    const message = String(req.body?.message ?? '').trim();
    if (!message) throw new HttpError(400, 'Say something.');
    if (message.length > MAX_MESSAGE_CHARS) throw new HttpError(400, `Keep it under ${MAX_MESSAGE_CHARS} characters.`);

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db().from('messages').select('id', { count: 'exact', head: true })
      .eq('player_id', player.id).eq('role', 'user').gte('created_at', oneMinuteAgo);
    if (count >= RATE_LIMIT_PER_MIN) throw new HttpError(429, 'Easy, slow down. Lou needs a minute.');

    // Gather what Lou "remembers": picks + record from the DB, plus a few games on the board.
    const [picks, past, board] = await Promise.all([
      db().from('picks').select('*').eq('player_id', player.id)
        .order('created_at', { ascending: false }).limit(50).then(unwrap),
      history(player.id, HISTORY_TURNS),
      getGames('nfl').catch(() => []),
    ]);

    // If the question came from a game page, add that game's numbers.
    const extra = [];
    const ctx = req.body?.context;
    if (ctx && SPORTS[ctx.sport] && typeof ctx.gameId === 'string' && ctx.gameId.length < 100) {
      const brief = await buildGameFile(ctx.sport, ctx.gameId).catch(() => null);
      if (brief) extra.push({ type: 'text', text: brief });
    }

    // The API needs the conversation to start with a user turn.
    const turns = past.map(({ role, content }) => ({ role, content }));
    while (turns.length && turns[0].role !== 'user') turns.shift();

    anthropic ??= new Anthropic();
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4096, // a ceiling, not a target: thinking tokens count toward it
      output_config: { effort: 'low' },
      // If Lou's reply is ever declined by a safety classifier, retry on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: PERSONA },
        { type: 'text', text: playerFile(player, summarize(picks), picks, board) },
        ...extra,
      ],
      messages: [...turns, { role: 'user', content: message }],
    }).catch((err) => {
      console.error('[chat] anthropic error', err.status, err.message);
      throw new HttpError(502, 'Lou stepped out for a smoke. Try again in a sec.');
    });

    if (response.stop_reason === 'refusal') throw new HttpError(422, "Lou won't touch that one. Ask him something else.");
    if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'Lou lost his train of thought. Try again.');

    const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
      || "...Lou just stares at you. (He didn't have an answer for that one.)";

    await db().from('messages').insert([
      { player_id: player.id, role: 'user', content: message },
      { player_id: player.id, role: 'assistant', content: reply },
    ]);

    return { reply };
  },
});

async function buildGameFile(sport, gameId) {
  const line = await findGame(sport, gameId);
  if (!line) return null;
  const load = async (name) => {
    const id = await findTeamId(sport, name);
    if (!id) return null;
    const t = await getTeam(sport, id);
    return { ...t, recent: t.schedule.filter((g) => g.result).slice(-5).reverse() };
  };
  const [home, away] = await Promise.all([load(line.home), load(line.away)]);
  return gameFile(line, home, away);
}
