// POST /api/settle -> grade this player's finished games and pay out.
// The frontend calls this on page load, so results show up next visit.
import { db, handle, unwrap } from './_lib/db.js';
import { requirePlayer, round2, STARTING_BANKROLL } from './_lib/player.js';
import { getScores, hasOddsKey } from './_lib/odds.js';
import { loadProfile } from './me.js';

const VOID_AFTER_DAYS = 3; // scores endpoint only looks back 3 days

// Profit on a winning bet at American odds.
export function profitOn(stake, price) {
  return price > 0 ? stake * (price / 100) : stake * (100 / -price);
}

// Decides one pick's result from a final score. Exported so it's easy to test.
export function grade(pick, game) {
  const mine = game.score[pick.team];
  const other = game.score[pick.team === pick.home_team ? pick.away_team : pick.home_team];
  if (mine == null || other == null) return null;
  if (mine === other) return { status: 'push', payout: Number(pick.stake) };
  if (mine > other) return { status: 'won', payout: round2(Number(pick.stake) + profitOn(Number(pick.stake), pick.price)) };
  return { status: 'lost', payout: 0 };
}

export default handle({
  async POST(req) {
    const player = await requirePlayer(req);
    const settled = [];

    if (hasOddsKey()) {
      const pending = unwrap(
        await db().from('picks').select('*')
          .eq('player_id', player.id).eq('status', 'pending')
          .lt('commence_time', new Date().toISOString()),
      );

      // One scores request per sport, not per pick.
      const sports = [...new Set(pending.map((p) => p.sport))];
      // If the scores feed is down or out of quota, skip that sport this time
      // instead of failing the whole request. Picks just stay open until next visit.
      const scores = Object.fromEntries(
        await Promise.all(sports.map(async (s) => {
          try { return [s, await getScores(s)]; }
          catch (err) { console.error(`[settle] scores for ${s} failed:`, err.message); return [s, null]; }
        })),
      );

      for (const pick of pending) {
        if (!scores[pick.sport]) continue;
        const game = scores[pick.sport][pick.event_id];
        let result = game ? grade(pick, game) : null;

        const ageDays = (Date.now() - new Date(pick.commence_time)) / 86_400_000;
        if (!result && ageDays > VOID_AFTER_DAYS) {
          result = { status: 'push', payout: Number(pick.stake) }; // never found a score: refund
        }
        if (!result) continue;

        const { data: ok } = await db().rpc('settle_pick', {
          p_pick: pick.id, p_status: result.status, p_payout: result.payout,
        });
        if (ok) settled.push({ ...pick, ...result });
      }
    }

    // Busted with nothing left in play? Lou spots you a fresh bankroll (and remembers it).
    const fresh = await requirePlayer(req);
    if (Number(fresh.bankroll) < 1) {
      const { count } = await db().from('picks').select('id', { count: 'exact', head: true })
        .eq('player_id', player.id).eq('status', 'pending');
      if (count === 0) {
        await db().from('players')
          .update({ bankroll: STARTING_BANKROLL, rebuys: fresh.rebuys + 1 })
          .eq('id', player.id).lt('bankroll', 1);
      }
    }

    return { settled, ...(await loadProfile(await requirePlayer(req))) };
  },
});
