// "Ask the desk": all four characters' quick takes on one game, side by side.
import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../context.js';
import { personaById } from '../personas.js';
import Face from './Face.jsx';

export default function Panel({ game }) {
  const { askLou } = useApp();
  const [state, setState] = useState({ status: 'idle' });

  async function load() {
    setState({ status: 'loading' });
    try {
      const { takes } = await api('panel', { method: 'POST', body: { sport: game.sport, gameId: game.id } });
      setState({ status: 'ready', takes });
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  }

  if (state.status === 'idle' || state.status === 'error') {
    return (
      <div className="panel-cta">
        <div>
          <strong>Ask the desk</strong>
          <p className="muted small">Get all four handicappers' picks on this game, argued from the stats on this page.</p>
          {state.error && <p className="form-error">{state.error}</p>}
        </div>
        <button className="btn primary" onClick={load}>{state.error ? 'Try again' : 'Get their picks'}</button>
      </div>
    );
  }

  if (state.status === 'loading') {
    return <div className="panel-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="take skeleton" />)}</div>;
  }

  const votes = state.takes.filter((t) => t.pick);
  const tally = [game.away, game.home].map((team) => ({ team, n: votes.filter((v) => v.pick === team).length }));

  return (
    <>
      <div className="tally">
        {tally.map(({ team, n }) => (
          <span key={team}><strong>{n}</strong> on {game.teams?.[team]?.short || team}</span>
        ))}
      </div>
      <div className="panel-grid">
        {state.takes.map((t) => {
          const p = personaById(t.persona);
          return (
            <article key={t.persona} className="take" style={{ '--p': p.color }}>
              <header>
                <Face persona={p} size={40} />
                <div><strong>{p.name}</strong><div className="muted small">{p.title}</div></div>
                {t.pick && <span className="take-pick">{game.teams?.[t.pick]?.abbr || t.pick}</span>}
              </header>
              <p>{t.take || <span className="muted">{t.error || 'No take.'}</span>}</p>
              <button className="link-btn small" onClick={() => askLou(`About ${game.away} at ${game.home}: tell me more.`, { sport: game.sport, gameId: game.id }, t.persona)}>
                Ask {p.name} a follow-up ›
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
