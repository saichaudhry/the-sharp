// Team and game stats from ESPN's public site API (no key needed).
// Note: this API is undocumented, so ESPN could change it without notice.
// Everything below turns ESPN's very large responses into small, flat objects
// that the team and game pages can render directly.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

export const ESPN_PATH = {
  nfl: 'football/nfl',
  ncaaf: 'football/college-football',
  mlb: 'baseball/mlb',
  nba: 'basketball/nba',
};

// The headline stats for each sport: [category, stat name, label, lowerIsBetter]
const KEY_STATS = {
  football: [
    ['passing', 'yardsPerGame', 'Total yards / game'],
    ['passing', 'passingYardsPerGame', 'Pass yards / game'],
    ['rushing', 'rushingYardsPerGame', 'Rush yards / game'],
    ['passing', 'QBRating', 'QB rating'],
    ['miscellaneous', 'thirdDownConvPct', '3rd down %'],
    ['miscellaneous', 'redzoneTouchdownPct', 'Red zone TD %'],
    ['miscellaneous', 'turnOverDifferential', 'Turnover +/-'],
    ['defensive', 'sacks', 'Sacks (defense)'],
    ['miscellaneous', 'totalPenaltyYards', 'Penalty yards', true],
  ],
  baseball: [
    ['batting', 'runs', 'Runs'],
    ['batting', 'avg', 'Batting avg'],
    ['batting', 'OPS', 'OPS'],
    ['batting', 'homeRuns', 'Home runs'],
    ['batting', 'stolenBases', 'Stolen bases'],
    ['pitching', 'ERA', 'ERA', true],
    ['pitching', 'WHIP', 'WHIP', true],
    ['pitching', 'strikeoutsPerNineInnings', 'K / 9'],
    ['fielding', 'errors', 'Errors', true],
  ],
  basketball: [
    ['offensive', 'avgPoints', 'Points / game'],
    ['offensive', 'fieldGoalPct', 'FG %'],
    ['offensive', 'threePointPct', '3PT %'],
    ['offensive', 'freeThrowPct', 'FT %'],
    ['general', 'avgRebounds', 'Rebounds / game'],
    ['offensive', 'avgAssists', 'Assists / game'],
    ['offensive', 'avgTurnovers', 'Turnovers / game', true],
    ['defensive', 'avgSteals', 'Steals / game'],
    ['defensive', 'avgBlocks', 'Blocks / game'],
  ],
};

const GROUP_LABELS = {
  offense: 'Offense', defense: 'Defense', specialTeam: 'Special teams',
  injuredReserveOrOut: 'Injured reserve / out', suspended: 'Suspended', practiceSquad: 'Practice squad',
  pitchers: 'Pitchers', catchers: 'Catchers', infielders: 'Infielders', outfielders: 'Outfielders',
  designatedHitter: 'Designated hitter',
};

// ---- Fetch with a small in-memory cache ----------------------------------
// (Vercel's CDN also caches our responses; see the Cache-Control header in api/team.js.)
const memory = new Map();

async function espn(path, ttlMinutes = 5) {
  const hit = memory.get(path);
  if (hit && Date.now() - hit.at < ttlMinutes * 60_000) return hit.data;

  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) {
    const err = new Error(res.status === 404 ? 'Not found on ESPN.' : 'ESPN stats are unavailable right now.');
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  const data = await res.json();
  memory.set(path, { at: Date.now(), data });
  return data;
}

const kind = (sport) => ESPN_PATH[sport].split('/')[0]; // football | baseball | basketball
const logoOf = (team) => team?.logos?.[0]?.href || team?.logo || null;
const color = (hex) => (hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null);

// ---- Team lookup by name (Odds API names -> ESPN ids) ---------------------

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export async function teamList(sport) {
  const data = await espn(`${ESPN_PATH[sport]}/teams?limit=1000`, 24 * 60);
  return data.sports[0].leagues[0].teams.map(({ team }) => ({
    id: team.id,
    name: team.displayName,
    short: team.shortDisplayName,
    location: team.location,
    nickname: team.name,
    abbr: team.abbreviation,
    logo: logoOf(team),
  }));
}

export async function findTeamId(sport, name) {
  const teams = await teamList(sport);
  const n = norm(name);
  const exact = teams.find((t) => norm(t.name) === n);
  if (exact) return exact.id;
  // Fallback: the name contains both the location and nickname ("LA Chargers" style mismatches).
  const loose = teams.find((t) => n.includes(norm(t.nickname)) && n.includes(norm(t.location).split(' ')[0]));
  return loose?.id ?? null;
}

// ---- Team hub ---------------------------------------------------------------

export async function getTeam(sport, id) {
  const p = `${ESPN_PATH[sport]}/teams/${id}`;
  // Four ESPN requests in parallel; a failure in the optional ones just leaves that section empty.
  const [teamRes, roster, schedule, stats] = await Promise.all([
    espn(p),
    espn(`${p}/roster`).catch(() => null),
    espn(`${p}/schedule`).catch(() => null),
    espn(`${p}/statistics?seasontype=2`).catch(() => null),
  ]);
  const team = teamRes.team;

  const players = normalizeRoster(roster);
  const categories = stats?.results?.stats?.categories || [];

  return {
    id: team.id,
    sport,
    name: team.displayName,
    short: team.shortDisplayName,
    abbr: team.abbreviation,
    logo: logoOf(team),
    color: color(team.color) || '#2b3a31',
    altColor: color(team.alternateColor),
    standing: team.standingSummary || null,
    record: recordOf(team.record),
    coach: roster?.coach?.[0]
      ? {
          name: `${roster.coach[0].firstName} ${roster.coach[0].lastName}`,
          experience: roster.coach[0].experience ?? null,
        }
      : null,
    roster: players,
    injuries: players.flatMap((g) => g.players).filter((pl) => pl.injury),
    schedule: normalizeSchedule(schedule, team.id),
    statsSeason: stats?.season?.displayName || stats?.season?.year || null, // regular season
    keyStats: keyStatsOf(sport, categories),
    allStats: categories.map((c) => ({
      name: c.displayName,
      stats: c.stats
        .filter((s) => s.displayValue != null && !/teamGamesPlayed|isQualified|WARBR/.test(s.name))
        .map((s) => ({ label: s.displayName, value: s.displayValue, perGame: s.perGameDisplayValue ?? null })),
    })),
    espnUrl: team.links?.find((l) => l.rel?.includes('clubhouse'))?.href || null,
  };
}

function recordOf(record) {
  const items = record?.items || [];
  const total = items.find((i) => i.type === 'total') || items[0];
  const stat = (name) => total?.stats?.find((s) => s.name === name)?.value;
  return {
    overall: total?.summary || null,
    splits: items.filter((i) => i !== total).map((i) => ({ label: i.description || i.type, value: i.summary })),
    pointsFor: stat('avgPointsFor') ?? null,
    pointsAgainst: stat('avgPointsAgainst') ?? null,
    differential: stat('differential') ?? null,
    streak: stat('streak') ?? null,
  };
}

function normalizeRoster(roster) {
  if (!roster?.athletes) return [];
  // NFL/NCAAF/MLB rosters come grouped by unit; NBA is one flat list.
  const groups = roster.athletes[0]?.items
    ? roster.athletes.map((g) => ({ label: GROUP_LABELS[g.position] || g.position, items: g.items }))
    : [{ label: 'Roster', items: roster.athletes }];

  return groups
    .filter((g) => g.items.length)
    .map((g) => ({
      label: g.label,
      players: g.items.map((a) => {
        const inj = a.injuries?.[0];
        return {
          id: a.id,
          name: a.displayName || a.fullName,
          jersey: a.jersey ?? null,
          pos: a.position?.abbreviation || '',
          age: a.age ?? null,
          height: a.displayHeight || null,
          weight: a.displayWeight || null,
          exp: a.experience?.years ?? null,
          college: a.college?.name || null,
          headshot: a.headshot?.href || null,
          injury: inj && inj.status !== 'Active' ? inj.status : null,
        };
      }),
    }));
}

function normalizeSchedule(schedule, teamId) {
  return (schedule?.events || []).map((e) => {
    const comp = e.competitions[0];
    const me = comp.competitors.find((c) => c.team.id === teamId) || comp.competitors[0];
    const opp = comp.competitors.find((c) => c !== me);
    const score = (c) => c?.score?.displayValue ?? c?.score ?? null;
    const done = comp.status?.type?.completed;
    return {
      id: e.id,
      date: e.date,
      label: e.week?.text || e.seasonType?.name || '',
      home: me.homeAway === 'home',
      opponent: { id: opp?.team.id, name: opp?.team.displayName, abbr: opp?.team.abbreviation, logo: logoOf(opp?.team) },
      result: done ? (me.winner ? 'W' : opp?.winner ? 'L' : 'T') : null,
      score: done ? `${score(me)}-${score(opp)}` : null,
      status: comp.status?.type?.shortDetail || '',
    };
  });
}

function keyStatsOf(sport, categories) {
  const find = (cat, name) => categories.find((c) => c.name === cat)?.stats.find((s) => s.name === name);
  return KEY_STATS[kind(sport)]
    .map(([cat, name, label, lowerIsBetter]) => {
      const s = find(cat, name);
      return s ? { key: name, label, value: s.displayValue, raw: s.value, lowerIsBetter: !!lowerIsBetter } : null;
    })
    .filter(Boolean);
}

// ---- Game hub ---------------------------------------------------------------

// ESPN's scoreboard is organised by US Eastern date, so convert from UTC first.
function easternDate(iso, offsetDays = 0) {
  const d = new Date(new Date(iso).getTime() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts.replaceAll('-', '');
}

// Finds the ESPN event for a matchup from The Odds API.
export async function findEventId(sport, homeId, awayId, commence) {
  const extra = sport === 'ncaaf' ? '&groups=80&limit=300' : '&limit=300'; // groups=80 = all of FBS, not just the top 25
  for (const offset of [0, -1, 1]) {
    const board = await espn(`${ESPN_PATH[sport]}/scoreboard?dates=${easternDate(commence, offset)}${extra}`).catch(() => null);
    const match = board?.events?.find((e) => {
      const ids = e.competitions[0].competitors.map((c) => c.team.id);
      return ids.includes(homeId) && ids.includes(awayId);
    });
    if (match) return match.id;
  }
  return null;
}

export async function getEvent(sport, eventId) {
  const s = await espn(`${ESPN_PATH[sport]}/summary?event=${eventId}`, 2);
  const comp = s.header?.competitions?.[0];
  const pick = s.pickcenter?.[0];

  return {
    id: eventId,
    status: { state: comp?.status?.type?.state, detail: comp?.status?.type?.shortDetail },
    scores: Object.fromEntries((comp?.competitors || []).map((c) => [c.team.id, c.score ?? null])),
    venue: s.gameInfo?.venue
      ? { name: s.gameInfo.venue.fullName, city: [s.gameInfo.venue.address?.city, s.gameInfo.venue.address?.state].filter(Boolean).join(', '), indoor: s.gameInfo.venue.indoor ?? null }
      : null,
    weather: s.gameInfo?.weather ? { temp: s.gameInfo.weather.temperature, text: s.gameInfo.weather.displayValue } : null,
    broadcast: (s.broadcasts || []).map((b) => b.media?.shortName).filter(Boolean).join(', ') || null,
    line: pick
      ? {
          provider: pick.provider?.name,
          details: pick.details,
          overUnder: pick.overUnder ?? null,
          homeML: pick.homeTeamOdds?.moneyLine ?? null,
          awayML: pick.awayTeamOdds?.moneyLine ?? null,
        }
      : null,
    // Season stat comparison for the two teams (pregame), or the box score once the game starts.
    comparison: (() => {
      const teams = s.boxscore?.teams || [];
      if (teams.length !== 2) return [];
      const [a, b] = teams;
      return (a.statistics || []).map((st) => ({
        label: st.label || st.name,
        values: { [a.team.id]: st.displayValue, [b.team.id]: b.statistics?.find((x) => x.name === st.name)?.displayValue ?? '-' },
      }));
    })(),
    leaders: (s.leaders || []).map((t) => ({
      teamId: t.team?.id,
      categories: (t.leaders || []).slice(0, 4).map((cat) => {
        const top = cat.leaders?.[0];
        return top
          ? { label: cat.displayName, name: top.athlete?.displayName, headshot: top.athlete?.headshot?.href || null, value: top.displayValue }
          : null;
      }).filter(Boolean),
    })),
    injuries: Object.fromEntries((s.injuries || []).map((t) => [
      t.team?.id,
      (t.injuries || []).map((i) => ({
        name: i.athlete?.displayName,
        pos: i.athlete?.position?.abbreviation || '',
        status: i.status,
        detail: [i.details?.type, i.details?.location].filter((x) => x && x !== 'Not Specified').join(' · ') || null,
        returnDate: i.details?.returnDate || null,
        headshot: i.athlete?.headshot?.href || null,
      })),
    ])),
    ats: (s.againstTheSpread || []).map((t) => ({ teamId: t.team?.id, records: (t.records || []).map((r) => ({ label: r.type || r.name, value: r.summary })) })),
    news: (s.news?.articles || []).slice(0, 4).map((a) => ({ headline: a.headline, url: a.links?.web?.href, published: a.published })),
  };
}
