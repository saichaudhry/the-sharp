// GET /api/game?sport=nfl&id=<Kalshi event ticker>
// Builds the game hub: the Kalshi price + both teams' hubs + ESPN's game page
// (venue, TV, betting line, injuries, leaders, stat comparison, news).
import { handle, HttpError } from './_lib/db.js';
import { findGame, SPORTS } from './_lib/odds.js';
import { getEvent, getTeam } from './_lib/espn.js';

// A smaller version of the team hub for the game page (no full roster or stat dump).
const brief = ({ roster, allStats, ...team }) => ({
  ...team,
  recent: team.schedule.filter((g) => g.result).slice(-5).reverse(),
});

export default handle({
  async GET(req, res) {
    const sport = String(req.query.sport || '');
    if (!SPORTS[sport]) throw new HttpError(400, `Unknown sport "${sport}".`);

    const line = await findGame(sport, String(req.query.id || ''));
    if (!line) throw new HttpError(404, 'That game is no longer on the board.');

    // Kalshi games were matched to ESPN when the board was built, so the ids are already known.
    const { homeId, awayId, eventId } = line.espn;
    const [home, away, event] = await Promise.all([
      getTeam(sport, homeId).then(brief).catch(() => null),
      getTeam(sport, awayId).then(brief).catch(() => null),
      getEvent(sport, eventId).catch(() => null),
    ]);

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return { line, home, away, event };
  },
});
