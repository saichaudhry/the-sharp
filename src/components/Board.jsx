// The board: a featured game (most traded) with its price chart, then every
// upcoming game grouped by day. Tapping a price puts it in the bet slip.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.js';
import { centsOf, fmtPrice, kickoff, payoutOn100 } from '../format.js';
import { readable, distinct } from '../colors.js';
import { TeamLogo } from './hub.jsx';
import PriceChart from './PriceChart.jsx';

export const SPORTS = [
  { id: 'nfl', label: 'Pro Football', short: 'NFL', icon: '🏈' },
  { id: 'ncaaf', label: 'College Football', short: 'CFB', icon: '🏟️' },
  { id: 'mlb', label: 'Baseball', short: 'MLB', icon: '⚾' },
  { id: 'nba', label: 'Basketball', short: 'NBA', icon: '🏀' },
];

// Groups games under "Today", "Tomorrow", "Sat, Oct 10" headers (college has dozens).
function byDay(games) {
  const groups = new Map();
  for (const g of games) {
    const d = new Date(g.commence);
    const diff = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 86_400_000);
    const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(g);
  }
  return [...groups];
}

const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const teamColors = (g) => {
  const a = readable(g.teams?.[g.away]?.color, g.teams?.[g.away]?.altColor);
  return [a, distinct(a, readable(g.teams?.[g.home]?.color, g.teams?.[g.home]?.altColor), g.teams?.[g.home]?.altColor)];
};

export default function Board() {
  const { sport, select, selection } = useApp();
  const [state, setState] = useState({ status: 'loading', games: [] });
  const [reload, setReload] = useState(0);
  const label = SPORTS.find((s) => s.id === sport)?.label;

  useEffect(() => {
    let cancelled = false; // ignore a slow response if the user already switched sports
    setState((s) => ({ ...s, status: 'loading' }));
    api(`odds?sport=${sport}`)
      .then((d) => !cancelled && setState({ status: 'ready', games: d.games }))
      .catch((err) => !cancelled && setState({ status: 'error', games: [], error: err.message }));
    return () => { cancelled = true; };
  }, [sport, reload]);

  const isOn = (g, team) => selection?.game.id === g.id && selection.team === team;
  const featured = state.games.length ? [...state.games].sort((a, b) => b.volume - a.volume)[0] : null;

  return (
    <div className="board">
      <div className="page-head">
        <div>
          <span className="eyebrow">Kalshi · live</span>
          <h1>{label}</h1>
        </div>
        <div className="sport-tabs" role="tablist">
          {SPORTS.map((s) => <SportTab key={s.id} s={s} />)}
        </div>
      </div>

      {state.status === 'loading' && (
        <><div className="featured skeleton" /><div className="games">{[0, 1, 2, 3].map((i) => <div key={i} className="game skeleton" />)}</div></>
      )}

      {state.status === 'error' && (
        <div className="empty">
          <p>{state.error}</p>
          <button className="btn" onClick={() => setReload((n) => n + 1)}>Retry</button>
        </div>
      )}

      {state.status === 'ready' && !state.games.length && (
        <div className="empty">
          <p>No {label} games this week.</p>
        </div>
      )}

      {featured && state.status === 'ready' && (
        <section className="featured">
          <div className="featured-main">
            <div className="muted small">{kickoff(featured.commence)} · ${compact(featured.volume)} vol</div>
            <h2 className="featured-title">
              {featured.teams?.[featured.away]?.short || featured.away} <span className="muted">at</span> {featured.teams?.[featured.home]?.short || featured.home}
            </h2>
            <div className="featured-sides">
              {[featured.away, featured.home].map((team) => (
                <div key={team} className="featured-side">
                  <button className={`price-btn big ${isOn(featured, team) ? 'on' : ''}`} onClick={() => select({ game: featured, team })}>
                    <TeamLogo src={featured.teams?.[team]?.logo} alt={featured.teams?.[team]?.abbr} size={28} />
                    <span>{featured.teams?.[team]?.abbr}</span>
                    <span className="pct">{centsOf(featured, team)}%</span>
                  </button>
                  <span className="payout muted small">$100 <span aria-hidden="true">›</span> ${payoutOn100(featured.prices[team])}</span>
                </div>
              ))}
            </div>
            <Link to={`/game/${sport}/${encodeURIComponent(featured.id)}`} className="text-link">Matchup ›</Link>
          </div>
          <PriceChart game={featured} colors={teamColors(featured)} />
        </section>
      )}

      {state.status === 'ready' && byDay(state.games).map(([day, games]) => (
        <section key={day} className="day-group">
          <h3 className="day-head">{day} <span className="muted small">{games.length} game{games.length > 1 ? 's' : ''}</span></h3>
          <div className="games">
            {games.map((g) => (
              <article key={g.id} className="game">
                <Link to={`/game/${sport}/${encodeURIComponent(g.id)}`} className="game-meta">
                  <span>{kickoff(g.commence)}</span>
                  <span className="muted">{g.volume ? `$${compact(g.volume)} vol` : ''} ›</span>
                </Link>
                {[g.away, g.home].map((team) => (
                  <button key={team} className={`side ${isOn(g, team) ? 'on' : ''}`} onClick={() => select({ game: g, team })}>
                    <TeamLogo src={g.teams?.[team]?.logo} alt={g.teams?.[team]?.abbr} size={24} />
                    <span className="team">
                      {g.teams?.[team]?.short || team}
                      <small className="muted"> {g.teams?.[team]?.record}{team === g.home ? ' · home' : ''}</small>
                    </span>
                    <span className="american muted small">{fmtPrice(g.prices[team])}</span>
                    <span className="pct">{centsOf(g, team)}%</span>
                  </button>
                ))}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SportTab({ s }) {
  const { sport, setSport } = useApp();
  return (
    <button role="tab" aria-selected={sport === s.id} className={sport === s.id ? 'active' : ''} onClick={() => setSport(s.id)}>
      {s.short}
    </button>
  );
}
