// GET  /api/chat?persona=lou                 -> that character's chat history
// POST /api/chat {message, persona, context?} -> talk to one character
//
// Each character keeps its own conversation (messages.persona), and all of
// them see the same PLAYER FILE, so they all "remember" your picks.
import { db, handle, HttpError, unwrap } from './_lib/db.js';
import { requirePlayer, summarize } from './_lib/player.js';
import { findGame, getGames, SPORTS } from './_lib/odds.js';
import { getTeam } from './_lib/espn.js';
import { DEFAULT_PERSONA, gameFile, PERSONAS, playerFile, systemPrompt } from './_lib/persona.js';
import { ask } from './_lib/claude.js';

const MAX_MESSAGE_CHARS = 500;
const HISTORY_TURNS = 16;      // how many past messages Claude sees
const RATE_LIMIT_PER_MIN = 6;  // stops one tab from draining the API budget

// Until the `persona` column exists (see schema.sql), everyone shares one thread.
let personaColumn = true;
const missingColumn = (err) => err?.code === '42703' || /persona/.test(err?.message || '');

async function history(playerId, persona, limit) {
  const query = () => db().from('messages').select('role, content, created_at')
    .eq('player_id', playerId).order('id', { ascending: false }).limit(limit);
  let res = personaColumn ? await query().eq('persona', persona) : await query();
  if (res.error && missingColumn(res.error)) {
    personaColumn = false;
    res = await query();
  }
  return unwrap(res).reverse();
}

async function save(rows) {
  let { error } = await db().from('messages').insert(personaColumn ? rows : rows.map(({ persona, ...r }) => r));
  if (error && missingColumn(error)) {
    personaColumn = false;
    ({ error } = await db().from('messages').insert(rows.map(({ persona, ...r }) => r)));
  }
  if (error) throw error;
}

const personaFrom = (v) => (PERSONAS[v] ? v : DEFAULT_PERSONA);

export default handle({
  async GET(req) {
    const player = await requirePlayer(req);
    return { messages: await history(player.id, personaFrom(req.query.persona), 50) };
  },

  async POST(req) {
    const player = await requirePlayer(req);
    const persona = personaFrom(req.body?.persona);
    const message = String(req.body?.message ?? '').trim();
    if (!message) throw new HttpError(400, 'Say something.');
    if (message.length > MAX_MESSAGE_CHARS) throw new HttpError(400, `Keep it under ${MAX_MESSAGE_CHARS} characters.`);

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db().from('messages').select('id', { count: 'exact', head: true })
      .eq('player_id', player.id).eq('role', 'user').gte('created_at', oneMinuteAgo);
    if (count >= RATE_LIMIT_PER_MIN) throw new HttpError(429, 'Easy, slow down. Give the desk a minute.');

    // What the character "remembers": picks + record from the DB, plus a few games on the board.
    const [picks, past, board] = await Promise.all([
      db().from('picks').select('*').eq('player_id', player.id)
        .order('created_at', { ascending: false }).limit(50).then(unwrap),
      history(player.id, persona, HISTORY_TURNS),
      getGames('nfl').catch(() => []),
    ]);

    // If the question came from a game page, add that game's numbers.
    const extra = [];
    const ctx = req.body?.context;
    if (ctx && SPORTS[ctx.sport] && typeof ctx.gameId === 'string' && ctx.gameId.length < 100) {
      const brief = await buildGameFile(ctx.sport, ctx.gameId).catch(() => null);
      if (brief) extra.push({ type: 'text', text: brief.text });
    }

    // The API needs the conversation to start with a user turn.
    const turns = past.map(({ role, content }) => ({ role, content }));
    while (turns.length && turns[0].role !== 'user') turns.shift();

    const reply = (await ask({
      system: [
        { type: 'text', text: systemPrompt(persona) },
        { type: 'text', text: playerFile(player, summarize(picks), picks, board) },
        ...extra,
      ],
      messages: [...turns, { role: 'user', content: message }],
    })) || '...(no answer for that one)';

    await save([
      { player_id: player.id, persona, role: 'user', content: message },
      { player_id: player.id, persona, role: 'assistant', content: reply },
    ]);
    return { reply, persona };
  },
});

export async function buildGameFile(sport, gameId) {
  const line = await findGame(sport, gameId);
  if (!line) return null;
  const load = async (id) => {
    const t = await getTeam(sport, id).catch(() => null);
    return t && { ...t, recent: t.schedule.filter((g) => g.result).slice(-5).reverse() };
  };
  const [home, away] = await Promise.all([load(line.espn.homeId), load(line.espn.awayId)]);
  return { line, text: gameFile(line, home, away) };
}
