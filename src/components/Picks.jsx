import { useState } from 'react';
import { fmtPrice, money, kickoff, profitOn } from '../format.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Open' },
  { id: 'settled', label: 'Settled' },
];

export default function Picks({ picks }) {
  const [filter, setFilter] = useState('all');
  const shown = picks.filter((p) =>
    filter === 'all' ? true : filter === 'pending' ? p.status === 'pending' : p.status !== 'pending',
  );

  return (
    <div className="picks">
      <div className="section-head">
        <h2>My Picks</h2>
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>{picks.length ? 'Nothing here.' : 'No picks yet. Lou is waiting.'}</p>
        </div>
      ) : (
        <ul className="pick-list">
          {shown.map((p) => {
            const opponent = p.team === p.home_team ? p.away_team : p.home_team;
            const net = p.status === 'pending' ? profitOn(Number(p.stake), p.price) : Number(p.payout) - Number(p.stake);
            return (
              <li key={p.id} className={`pick ${p.status}`}>
                <div className="pick-main">
                  <strong>{p.team}</strong> <span className="price-inline">{fmtPrice(p.price)}</span>
                  <div className="muted small">vs {opponent} · {kickoff(p.commence_time)}</div>
                </div>
                <div className="pick-side">
                  <span className={`status ${p.status}`}>{p.status === 'pending' ? 'open' : p.status}</span>
                  <div className="small">
                    {money(p.stake)}{' '}
                    <span className={p.status === 'lost' ? 'loss' : p.status === 'won' ? 'win' : 'muted'}>
                      {p.status === 'pending' ? `to win ${money(net)}` : money(net, { sign: true })}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
