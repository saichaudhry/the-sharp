// GET  /api/me           -> the current player, their stats and their picks
// POST /api/me {name}    -> create the player for this x-player-id
import { db, handle, HttpError, unwrap } from './_lib/db.js';
import { playerIdFrom, requirePlayer, summarize, STARTING_BANKROLL } from './_lib/player.js';

const NAME_RE = /^[\p{L}\p{N} _.'-]{1,24}$/u;

export async function loadProfile(player) {
  const picks = unwrap(
    await db().from('picks').select('*').eq('player_id', player.id)
      .order('created_at', { ascending: false }).limit(200),
  );
  return { player, stats: summarize(picks), picks };
}

export default handle({
  async GET(req) {
    return loadProfile(await requirePlayer(req));
  },

  async POST(req) {
    const id = playerIdFrom(req);
    const name = String(req.body?.name ?? '').trim();
    if (!NAME_RE.test(name)) {
      throw new HttpError(400, 'Name must be 1-24 letters, numbers, spaces or . _ \' -');
    }
    const { data, error } = await db().from('players')
      .insert({ id, name, bankroll: STARTING_BANKROLL }).select().single();
    if (error?.code === '23505') throw new HttpError(409, 'Player already exists.');
    if (error) throw error;
    return loadProfile(data);
  },
});
