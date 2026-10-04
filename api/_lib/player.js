// Identity: the browser makes a random UUID once, keeps it in localStorage,
// and sends it as the `x-player-id` header. A v4 UUID has 122 random bits, so
// it works like an unguessable bearer token. That's fine for play money; a
// real-money app would use proper auth (Supabase Auth, OAuth, etc.).
import { db, HttpError, unwrap } from './db.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const STARTING_BANKROLL = 1000;

export function playerIdFrom(req) {
  const id = req.headers['x-player-id'];
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new HttpError(401, 'Missing or invalid player id.');
  }
  return id.toLowerCase();
}

export async function requirePlayer(req) {
  const id = playerIdFrom(req);
  const player = unwrap(await db().from('players').select('*').eq('id', id).maybeSingle());
  if (!player) throw new HttpError(404, 'Player not found.');
  return player;
}

// Win/loss record and profit, computed from the player's settled picks.
export function summarize(picks) {
  const settled = picks.filter((p) => p.status !== 'pending');
  const won = settled.filter((p) => p.status === 'won').length;
  const lost = settled.filter((p) => p.status === 'lost').length;
  const push = settled.filter((p) => p.status === 'push').length;
  const staked = settled.reduce((s, p) => s + Number(p.stake), 0);
  const profit = settled.reduce((s, p) => s + Number(p.payout) - Number(p.stake), 0);
  return {
    won, lost, push,
    pending: picks.length - settled.length,
    profit: round2(profit),
    roi: staked > 0 ? round2((profit / staked) * 100) : 0,
  };
}

export const round2 = (n) => Math.round(n * 100) / 100;
