// Everything that talks to The Odds API (https://the-odds-api.com) lives here.
// The free tier is 500 requests/month, so every response is cached for
// CACHE_MINUTES: first in memory, then in the Supabase `api_cache` table
// (shared across serverless instances and survives cold starts).
import { db } from './db.js';

export const SPORTS = {
  nfl:   { key: 'americanfootball_nfl',   label: 'NFL' },
  ncaaf: { key: 'americanfootball_ncaaf', label: 'College FB' },
  mlb:   { key: 'baseball_mlb',           label: 'MLB' },
  nba:   { key: 'basketball_nba',         label: 'NBA' },
};

const BASE = 'https://api.the-odds-api.com/v4/sports';
const CACHE_MINUTES = 10;
const PREFERRED_BOOKS = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
const memory = new Map();

export const hasOddsKey = () => Boolean(process.env.ODDS_API_KEY);

async function cached(key, fetcher) {
  const fresh = (t) => Date.now() - new Date(t).getTime() < CACHE_MINUTES * 60_000;

  const hit = memory.get(key);
  if (hit && fresh(hit.fetched_at)) return hit.data;

  let table = null;
  try { table = db().from('api_cache'); } catch { /* DB not configured: memory cache only */ }

  if (table) {
    const { data: row } = await table.select('data, fetched_at').eq('key', key).maybeSingle();
    if (row && fresh(row.fetched_at)) {
      memory.set(key, row);
      return row.data;
    }
  }

  const data = await fetcher();
  const row = { key, data, fetched_at: new Date().toISOString() };
  memory.set(key, row);
  if (table) await db().from('api_cache').upsert(row);
  return data;
}

async function oddsApi(path, params) {
  const qs = new URLSearchParams({ apiKey: process.env.ODDS_API_KEY, ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`);
  if (!res.ok) {
    const err = new Error(`Odds API ${res.status}`);
    err.status = res.status === 401 ? 500 : 502;
    err.message = res.status === 401
      ? 'Odds API key was rejected.'
      : res.status === 429 ? 'Odds API quota is used up for now.' : 'Odds provider is having trouble. Try again soon.';
    throw err;
  }
  console.log(`[odds] ${path} - requests remaining: ${res.headers.get('x-requests-remaining')}`);
  return res.json();
}

// Turns one raw Odds API event into the small shape the frontend uses.
function normalize(event, sport) {
  const book =
    PREFERRED_BOOKS.map((k) => event.bookmakers.find((b) => b.key === k)).find(Boolean) ||
    event.bookmakers[0];
  const market = book?.markets.find((m) => m.key === 'h2h');
  if (!market) return null;

  const prices = {};
  for (const o of market.outcomes) prices[o.name] = o.price;
  if (prices[event.home_team] == null || prices[event.away_team] == null) return null;

  return {
    id: event.id,
    sport,
    home: event.home_team,
    away: event.away_team,
    commence: event.commence_time,
    book: book.title,
    prices,
  };
}

// Upcoming games with moneyline prices. Games that already started are
// filtered out: you can't bet on them here.
export async function getGames(sport) {
  if (!SPORTS[sport]) return [];
  const games = hasOddsKey()
    ? await cached(`odds:${sport}`, async () => {
        const raw = await oddsApi(`${SPORTS[sport].key}/odds`, {
          regions: 'us', markets: 'h2h', oddsFormat: 'american',
        });
        return raw.map((e) => normalize(e, sport)).filter(Boolean);
      })
    : mockGames(sport);

  const now = Date.now();
  return games
    .filter((g) => new Date(g.commence).getTime() > now)
    .sort((a, b) => new Date(a.commence) - new Date(b.commence));
}

export async function findGame(sport, eventId) {
  const games = await getGames(sport);
  return games.find((g) => g.id === eventId) || null;
}

// Final scores from the last 3 days, keyed by event id.
export async function getScores(sport) {
  if (!hasOddsKey()) return {};
  const raw = await cached(`scores:${sport}`, () =>
    oddsApi(`${SPORTS[sport].key}/scores`, { daysFrom: '3' }),
  );
  const out = {};
  for (const g of raw) {
    if (!g.completed || !g.scores) continue;
    const score = Object.fromEntries(g.scores.map((s) => [s.name, Number(s.score)]));
    out[g.id] = { home: g.home_team, away: g.away_team, score };
  }
  return out;
}

// ---- Demo data -----------------------------------------------------------
// Used when ODDS_API_KEY isn't set, so the app still runs locally.

const MOCK_TEAMS = {
  nfl:   [['Buffalo Bills', 'Kansas City Chiefs'], ['Philadelphia Eagles', 'Dallas Cowboys'], ['Detroit Lions', 'Green Bay Packers'], ['Pittsburgh Steelers', 'Baltimore Ravens']],
  ncaaf: [['Ohio State Buckeyes', 'Michigan Wolverines'], ['Georgia Bulldogs', 'Alabama Crimson Tide'], ['Texas Longhorns', 'Oklahoma Sooners']],
  mlb:   [['Los Angeles Dodgers', 'New York Yankees'], ['Philadelphia Phillies', 'Atlanta Braves']],
  nba:   [['Boston Celtics', 'Denver Nuggets'], ['Oklahoma City Thunder', 'New York Knicks']],
};
const MOCK_PRICES = [[-150, 130], [110, -130], [-240, 195], [-105, -115]];

function mockGames(sport) {
  const day = Math.floor(Date.now() / 86_400_000);
  return (MOCK_TEAMS[sport] || []).map(([home, away], i) => {
    const [h, a] = MOCK_PRICES[i % MOCK_PRICES.length];
    return {
      id: `mock-${sport}-${day}-${i}`,
      sport, home, away,
      commence: new Date((day + 1) * 86_400_000 + i * 3 * 3_600_000).toISOString(),
      book: 'Demo odds',
      prices: { [home]: h, [away]: a },
    };
  });
}
