// GET /api/team?sport=nfl&id=2          -> full team hub (ESPN id)
// GET /api/team?sport=nfl&name=Buffalo%20Bills  -> same, looked up by name
import { handle, HttpError } from './_lib/db.js';
import { ESPN_PATH, findTeamId, getTeam } from './_lib/espn.js';

export default handle({
  async GET(req, res) {
    const sport = String(req.query.sport || '');
    if (!ESPN_PATH[sport]) throw new HttpError(400, `Unknown sport "${sport}".`);

    let id = req.query.id ? String(req.query.id) : null;
    if (!id && req.query.name) id = await findTeamId(sport, String(req.query.name));
    if (!id || !/^\d+$/.test(id)) throw new HttpError(404, "Couldn't find that team.");

    const team = await getTeam(sport, id);
    // Let Vercel's CDN serve repeat visits for 5 minutes (only on success).
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return team;
  },
});
