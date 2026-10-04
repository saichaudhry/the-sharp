// GET /api/odds?sport=nfl -> upcoming games with moneyline prices
import { handle, HttpError } from './_lib/db.js';
import { getGames, hasOddsKey, SPORTS } from './_lib/odds.js';

export default handle({
  async GET(req) {
    const sport = String(req.query.sport || 'nfl');
    if (!SPORTS[sport]) throw new HttpError(400, `Unknown sport "${sport}".`);
    const games = await getGames(sport);
    return { sport, demo: !hasOddsKey(), games };
  },
});
