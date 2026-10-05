// The strip of upcoming games across the top (every sport), like a market ticker.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { centsOf, kickoff } from '../format.js';
import { TeamLogo } from './hub.jsx';

const SPORTS = [['nfl', 'NFL'], ['mlb', 'MLB'], ['ncaaf', 'CFB'], ['nba', 'NBA']];

export default function Ticker() {
  const [games, setGames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(SPORTS.map(([s, label]) => api(`odds?sport=${s}`)
      .then((d) => d.games.slice(0, 6).map((g) => ({ ...g, label })))
      .catch(() => [])))
      .then((lists) => !cancelled && setGames(lists.flat().sort((a, b) => new Date(a.commence) - new Date(b.commence)).slice(0, 18)));
    return () => { cancelled = true; };
  }, []);

  if (!games.length) return <div className="ticker" aria-hidden="true" />;
  return (
    <nav className="ticker" aria-label="Upcoming games">
      {games.map((g) => (
        <Link key={g.id} to={`/game/${g.sport}/${encodeURIComponent(g.id)}`} className="tick">
          <span className="tick-meta"><span className="muted">{g.label} ·</span> {kickoff(g.commence)}</span>
          {[g.away, g.home].map((t) => (
            <span key={t} className="tick-row">
              <TeamLogo src={g.teams?.[t]?.logo} alt={g.teams?.[t]?.abbr || t} size={16} />
              <span className="tick-team">{g.teams?.[t]?.abbr || t}</span>
              <span className="pct">{centsOf(g, t)}%</span>
            </span>
          ))}
        </Link>
      ))}
    </nav>
  );
}
