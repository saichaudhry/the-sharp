// GET /api/odds?sport=nfl -> upcoming games with Kalshi prices
import { handle, HttpError } from './_lib/db.js';
import { getGames, SPORTS } from './_lib/odds.js';

export default handle({
  async GET(req, res) {
    const sport = String(req.query.sport || 'nfl');
    if (!SPORTS[sport]) throw new HttpError(400, `Unknown sport "${sport}".`);
    const games = await getGames(sport);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return { sport, games };
  },
});
