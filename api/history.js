// GET /api/history?sport=nfl&id=<Kalshi event ticker>
// -> each side's hourly Kalshi price for the last few days (for the price chart)
import { handle, HttpError } from './_lib/db.js';
import { findGame, priceHistory, SPORTS } from './_lib/odds.js';

export default handle({
  async GET(req, res) {
    const sport = String(req.query.sport || '');
    if (!SPORTS[sport]) throw new HttpError(400, `Unknown sport "${sport}".`);
    const game = await findGame(sport, String(req.query.id || ''));
    if (!game) throw new HttpError(404, 'That game is no longer on the board.');

    const series = Object.fromEntries(await Promise.all(
      [game.away, game.home].map(async (team) => [team, await priceHistory(sport, game.markets[team]).catch(() => [])]),
    ));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return { series };
  },
});
