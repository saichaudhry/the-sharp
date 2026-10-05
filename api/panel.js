// POST /api/panel {sport, gameId} -> every character's quick take on one game.
// The takes don't depend on who's asking, so they're cached per game for
// 10 minutes: four Claude calls per game, not four per click.
import { handle, HttpError } from './_lib/db.js';
import { requirePlayer } from './_lib/player.js';
import { SPORTS } from './_lib/odds.js';
import { PERSONAS, systemPrompt } from './_lib/persona.js';
import { ask } from './_lib/claude.js';
import { buildGameFile } from './chat.js';

const CACHE_MINUTES = 10;
const cache = new Map();

const INSTRUCTION = `Give your take on this game in at most 2 sentences, in character, using the GAME FILE.
Then on a final line write exactly: PICK: <full team name>`;

export default handle({
  async POST(req) {
    await requirePlayer(req); // only players can spend the API budget
    const { sport, gameId } = req.body || {};
    if (!SPORTS[sport] || typeof gameId !== 'string' || gameId.length > 100) throw new HttpError(400, 'Bad game.');

    const key = `${sport}:${gameId}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MINUTES * 60_000) return { takes: hit.takes };

    const game = await buildGameFile(sport, gameId);
    if (!game) throw new HttpError(404, 'That game is no longer on the board.');
    const { line, text } = game;

    const takes = await Promise.all(Object.keys(PERSONAS).map(async (id) => {
      try {
        const reply = await ask({
          system: [{ type: 'text', text: systemPrompt(id) }, { type: 'text', text }],
          messages: [{ role: 'user', content: INSTRUCTION }],
          maxTokens: 2048,
        });
        // Split off the "PICK: team" line and make sure it names one of the two teams.
        const m = reply.match(/PICK:\s*(.+)\s*$/i);
        const said = m?.[1]?.trim().toLowerCase() || '';
        const pick = [line.home, line.away].find((t) => said && (t.toLowerCase().includes(said) || said.includes(t.split(' ').pop().toLowerCase()))) || null;
        return { persona: id, take: reply.replace(/PICK:.*$/is, '').trim(), pick };
      } catch (err) {
        return { persona: id, take: null, pick: null, error: err.message };
      }
    }));

    cache.set(key, { at: Date.now(), takes });
    return { takes };
  },
});
