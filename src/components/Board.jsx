import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.js';
import { fmtPrice, kickoff, impliedProb } from '../format.js';
import BetSlip from './BetSlip.jsx';

export const SPORTS = [
  { id: 'nfl', label: 'NFL' },
  { id: 'ncaaf', label: 'College FB' },
  { id: 'mlb', label: 'MLB' },
  { id: 'nba', label: 'NBA' },
];

const SPORT_KEY = 'the-sharp:sport';
const savedSport = () => {
  try { return SPORTS.find((s) => s.id === localStorage.getItem(SPORT_KEY))?.id || 'nfl'; } catch { return 'nfl'; }
};

export default function Board() {
  const { player, onPlaced } = useApp();
  const [sport, setSport] = useState(savedSport);
  const [state, setState] = useState({ status: 'loading', games: [], demo: false });
  const [slip, setSlip] = useState(null); // { game, team }
  const [reload, setReload] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(SPORT_KEY, sport); } catch { /* ignore */ }
    let cancelled = false; // ignore a slow response if the user already switched sports
    setState((s) => ({ ...s, status: 'loading' }));
    api(`odds?sport=${sport}`)
      .then((d) => !cancelled && setState({ status: 'ready', games: d.games, demo: d.demo }))
      .catch((err) => !cancelled && setState({ status: 'error', games: [], error: err.message }));
    return () => { cancelled = true; };
  }, [sport, reload]);

  return (
    <div className="board">
      <div className="section-head">
        <h2>The Board</h2>
        {state.demo && <span className="tag" title="No Odds API key configured, showing sample games">Demo odds</span>}
      </div>

      <div className="sport-tabs" role="tablist">
        {SPORTS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={sport === s.id}
            className={sport === s.id ? 'active' : ''}
            onClick={() => setSport(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {state.status === 'loading' && (
        <div className="games">{[0, 1, 2].map((i) => <div key={i} className="game skeleton" />)}</div>
      )}

      {state.status === 'error' && (
        <div className="empty">
          <p>{state.error}</p>
          <button className="btn" onClick={() => setReload((n) => n + 1)}>Retry</button>
        </div>
      )}

      {state.status === 'ready' && state.games.length === 0 && (
        <div className="empty">
          <p>No upcoming {SPORTS.find((s) => s.id === sport).label} games on the board right now.</p>
          <p className="muted">Off-season, or everything already kicked off. Try another sport.</p>
        </div>
      )}

      {state.status === 'ready' && state.games.length > 0 && (
        <div className="games">
          {state.games.map((g) => (
            <article key={g.id} className="game">
              <div className="game-meta">
                <span>{kickoff(g.commence)}</span>
                <span className="muted">{g.book}</span>
              </div>
              {[g.away, g.home].map((team) => (
                <button key={team} className="side" onClick={() => setSlip({ game: g, team })}>
                  <span className="team">
                    {team}
                    {team === g.home && <small className="muted"> home</small>}
                  </span>
                  <span className="prob muted">{Math.round(impliedProb(g.prices[team]) * 100)}%</span>
                  <span className={`price ${g.prices[team] > 0 ? 'dog' : 'fav'}`}>{fmtPrice(g.prices[team])}</span>
                </button>
              ))}
              <Link className="game-link" to={`/game/${sport}/${encodeURIComponent(g.id)}`}>
                Matchup hub: stats, injuries, form <span aria-hidden="true">›</span>
              </Link>
            </article>
          ))}
        </div>
      )}

      {slip && (
        <BetSlip
          {...slip}
          bankroll={Number(player.bankroll)}
          onClose={() => setSlip(null)}
          onPlaced={(data, pick) => { setSlip(null); onPlaced(data, pick); }}
          onStale={() => { setSlip(null); setReload((n) => n + 1); }}
        />
      )}
    </div>
  );
}
