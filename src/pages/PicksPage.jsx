// My Picks: bankroll summary, open picks with the live Kalshi price, and
// settled picks grouped by day.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.js';
import { money, profitOn, kickoff } from '../format.js';
import { impliedProb } from '../format.js';
import ProfitChart from '../components/ProfitChart.jsx';

export default function PicksPage() {
  const { profile, setProfile, notify } = useApp();
  const { player, stats, picks } = profile;
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'settled' ? 'settled' : 'open';
  const [live, setLive] = useState({}); // pick id -> { cents, status }
  const [checking, setChecking] = useState(false);

  const open = picks.filter((p) => p.status === 'pending').sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));
  const settled = picks.filter((p) => p.status !== 'pending').sort((a, b) => new Date(b.settled_at) - new Date(a.settled_at));
  const atRisk = open.reduce((s, p) => s + Number(p.stake), 0);
  const potential = open.reduce((s, p) => s + Number(p.stake) + profitOn(Number(p.stake), p.price), 0);

  const loadLive = useCallback(() => {
    api('picks').then((d) => setLive(Object.fromEntries(d.live.map((l) => [l.id, l])))).catch(() => {});
  }, []);
  useEffect(() => { if (open.length) loadLive(); }, [open.length, loadLive]);

  async function checkResults() {
    setChecking(true);
    try {
      const data = await api('settle', { method: 'POST' });
      setProfile(data);
      const n = data.settled.length;
      notify({ text: n ? `${n} pick${n > 1 ? 's' : ''} settled.` : 'No new results yet. Games settle shortly after they end.', tone: n ? 'win' : 'neutral' });
      loadLive();
    } catch (err) {
      notify({ text: err.message, tone: 'loss' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="picks-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>My Picks</h1>
        </div>
        <button className="btn" onClick={checkResults} disabled={checking}>{checking ? 'Checking…' : 'Check results'}</button>
      </div>

      <section className="summary">
        <Stat label="Bankroll" value={money(player.bankroll)} big />
        <Stat label="In play" value={money(atRisk)} sub={`${open.length} open`} />
        <Stat label="Potential payout" value={money(potential)} />
        <Stat label="Record" value={`${stats.won}-${stats.lost}${stats.push ? `-${stats.push}` : ''}`} />
        <Stat label="Profit" value={money(stats.profit, { sign: true })} tone={stats.profit > 0 ? 'win' : stats.profit < 0 ? 'loss' : ''} />
        <Stat label="ROI" value={`${stats.roi}%`} tone={stats.roi > 0 ? 'win' : stats.roi < 0 ? 'loss' : ''} />
      </section>

      <section className="card chart-card">
        <h3>Profit over time</h3>
        <ProfitChart picks={picks} />
        {player.rebuys > 0 && <p className="muted small">Busted {player.rebuys}× · the desk has not forgotten.</p>}
      </section>

      <div className="hub-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'active' : ''} onClick={() => setParams({}, { replace: true })}>
          Open <span className="count">{open.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'settled'} className={tab === 'settled' ? 'active' : ''} onClick={() => setParams({ tab: 'settled' }, { replace: true })}>
          Settled <span className="count">{settled.length}</span>
        </button>
      </div>

      {tab === 'open' && (open.length ? (
        <ul className="pick-cards">
          {open.map((p) => <OpenPick key={p.id} p={p} live={live[p.id]} />)}
        </ul>
      ) : (
        <div className="empty">
          <p>No open picks.</p>
          <Link className="btn primary" to="/">Find a game</Link>
        </div>
      ))}

      {tab === 'settled' && (settled.length ? groupByDay(settled).map(([day, list]) => (
        <section key={day} className="day-group">
          <h3 className="day-head">{day}
            <span className={`small ${net(list) >= 0 ? 'win' : 'loss'}`}>{money(net(list), { sign: true })}</span>
          </h3>
          <ul className="pick-cards">{list.map((p) => <SettledPick key={p.id} p={p} />)}</ul>
        </section>
      )) : (
        <div className="empty"><p>Nothing settled yet. Results come in after games end.</p></div>
      ))}
    </div>
  );
}

const net = (list) => list.reduce((s, p) => s + Number(p.payout) - Number(p.stake), 0);

function groupByDay(list) {
  const groups = new Map();
  for (const p of list) {
    const label = new Date(p.settled_at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(p);
  }
  return [...groups];
}

function Stat({ label, value, sub, tone = '', big }) {
  return (
    <div className={`summary-stat ${big ? 'big' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{value}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

// When the game is, from the player's point of view.
function phase(p) {
  const start = new Date(p.commence_time).getTime();
  const mins = Math.round((start - Date.now()) / 60_000);
  if (mins > 60 * 24) return { label: kickoff(p.commence_time), tone: '' };
  if (mins > 60) return { label: `Starts in ${Math.round(mins / 60)}h`, tone: '' };
  if (mins > 0) return { label: `Starts in ${mins}m`, tone: 'soon' };
  if (mins > -4 * 60) return { label: 'In progress', tone: 'live' };
  return { label: 'Awaiting result', tone: '' };
}

function OpenPick({ p, live }) {
  const opponent = p.team === p.home_team ? p.away_team : p.home_team;
  const entry = Math.round(impliedProb(p.price) * 100);
  const now = live?.cents;
  const move = now != null ? now - entry : null;
  const ph = phase(p);
  const upcoming = new Date(p.commence_time) > new Date();
  return (
    <li className="pick-card open">
      <div className="pick-card-main">
        <span className={`phase ${ph.tone}`}>{ph.label}</span>
        <Link to={`/team/${p.sport}/${encodeURIComponent(p.team)}`} className="pick-team">{p.team}</Link>
        <span className="muted small">to beat {opponent}</span>
        {upcoming && <Link to={`/game/${p.sport}/${encodeURIComponent(p.event_id)}`} className="text-link small">Matchup hub ›</Link>}
      </div>
      <div className="pick-card-prices">
        <div><span className="stat-label">You got</span><strong>{entry}%</strong></div>
        <div>
          <span className="stat-label">Kalshi now</span>
          <strong className={move > 0 ? 'win' : move < 0 ? 'loss' : ''}>{now != null ? `${now}%` : '–'}</strong>
          {move != null && move !== 0 && <span className={`small ${move > 0 ? 'win' : 'loss'}`}>{move > 0 ? '▲' : '▼'} {Math.abs(move)}</span>}
        </div>
      </div>
      <div className="pick-card-money">
        <span className="muted small">{money(p.stake)} to win</span>
        <strong className="win">{money(profitOn(Number(p.stake), p.price))}</strong>
      </div>
    </li>
  );
}

function SettledPick({ p }) {
  const opponent = p.team === p.home_team ? p.away_team : p.home_team;
  const result = Number(p.payout) - Number(p.stake);
  return (
    <li className={`pick-card ${p.status}`}>
      <span className={`result-chip ${p.status === 'won' ? 'W' : p.status === 'lost' ? 'L' : 'T'}`}>
        {p.status === 'won' ? 'W' : p.status === 'lost' ? 'L' : 'P'}
      </span>
      <div className="pick-card-main">
        <Link to={`/team/${p.sport}/${encodeURIComponent(p.team)}`} className="pick-team">{p.team}</Link>
        <span className="muted small">vs {opponent} · at {Math.round(impliedProb(p.price) * 100)}%</span>
      </div>
      <div className="pick-card-money">
        <span className="muted small">{money(p.stake)} staked</span>
        <strong className={result > 0 ? 'win' : result < 0 ? 'loss' : 'muted'}>{money(result, { sign: true })}</strong>
      </div>
    </li>
  );
}
