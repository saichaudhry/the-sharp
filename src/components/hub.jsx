// Small building blocks shared by the game hub and team hub pages.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { kickoff } from '../format.js';

export function TeamLogo({ src, alt = '', size = 40 }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className="logo-fallback" style={{ width: size, height: size }}>{alt.slice(0, 2).toUpperCase()}</span>;
  }
  return <img className="logo" src={src} alt={alt} width={size} height={size} loading="lazy" onError={() => setBroken(true)} />;
}

export function Headshot({ src, name, size = 40 }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('');
  if (!src || broken) return <span className="headshot fallback" style={{ width: size, height: size }}>{initials}</span>;
  return <img className="headshot" src={src} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} />;
}

// Tabs whose selection lives in the URL (?tab=roster), so a tab can be linked to directly.
export function HubTabs({ tabs }) {
  const [params, setParams] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const current = visible.find((t) => t.id === params.get('tab')) || visible[0];

  return (
    <>
      <div className="hub-tabs" role="tablist">
        {visible.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t === current}
            className={t === current ? 'active' : ''}
            onClick={() => setParams(t === visible[0] ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
            {t.count > 0 && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="hub-body" key={current.id}>{current.render()}</div>
    </>
  );
}

const STATUS_TONE = { out: 'bad', 'injured reserve': 'bad', ir: 'bad', doubtful: 'warn', questionable: 'caution', 'day-to-day': 'caution', probable: 'ok' };
export const injuryTone = (status = '') => STATUS_TONE[status.toLowerCase()] || 'caution';

export function InjuryList({ injuries }) {
  if (!injuries?.length) return <p className="muted small none">No reported injuries.</p>;
  return (
    <ul className="injury-list">
      {injuries.map((i, n) => (
        <li key={`${i.name}-${n}`}>
          <Headshot src={i.headshot} name={i.name} size={32} />
          <div className="injury-main">
            <strong>{i.name}</strong> <span className="muted small">{i.pos}</span>
            {(i.detail || i.returnDate) && (
              <div className="muted small">
                {i.detail}{i.detail && i.returnDate ? ' · ' : ''}
                {i.returnDate && `est. return ${new Date(i.returnDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
              </div>
            )}
          </div>
          <span className={`inj-badge ${injuryTone(i.status || i.injury)}`}>{i.status || i.injury}</span>
        </li>
      ))}
    </ul>
  );
}

// W/L chips for recent results, newest first.
export function FormStrip({ games, sport }) {
  if (!games?.length) return <p className="muted small none">No completed games yet this season.</p>;
  return (
    <ul className="form-strip">
      {games.map((g) => (
        <li key={g.id} className={`form-game ${g.result}`}>
          <span className={`result-chip ${g.result}`}>{g.result}</span>
          <TeamLogo src={g.opponent.logo} alt={g.opponent.abbr || ''} size={22} />
          <Link to={`/team/${sport}/${g.opponent.id}`} className="form-opp">
            {g.home ? 'vs' : '@'} {g.opponent.abbr || g.opponent.name}
          </Link>
          <span className="form-score">{g.score}</span>
          <span className="muted small form-date">{new Date(g.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </li>
      ))}
    </ul>
  );
}

// Side-by-side bars comparing two teams on the same stats.
export function StatBars({ left, right, rows }) {
  if (!rows.length) return <p className="muted small none">No season stats yet.</p>;
  return (
    <div className="stat-bars">
      <div className="stat-bars-head">
        <span style={{ color: left.color }}>{left.abbr}</span>
        <span />
        <span style={{ color: right.color }}>{right.abbr}</span>
      </div>
      {rows.map((r) => {
        const a = Number(String(r.a).replace(/[^\d.-]/g, ''));
        const b = Number(String(r.b).replace(/[^\d.-]/g, ''));
        const both = Number.isFinite(a) && Number.isFinite(b);
        const total = both ? Math.abs(a) + Math.abs(b) || 1 : 1;
        const better = !both || a === b ? null : (a > b) !== !!r.lowerIsBetter ? 'left' : 'right';
        return (
          <div className="stat-bar-row" key={r.label}>
            <span className={`sb-val ${better === 'left' ? 'lead' : ''}`}>{r.a ?? '-'}</span>
            <div className="sb-mid">
              <span className="sb-label">{r.label}</span>
              <div className="sb-track">
                <span className="sb-fill left" style={{ width: `${both ? (Math.abs(a) / total) * 100 : 0}%`, background: left.color }} />
                <span className="sb-fill right" style={{ width: `${both ? (Math.abs(b) / total) * 100 : 0}%`, background: right.color }} />
              </div>
            </div>
            <span className={`sb-val ${better === 'right' ? 'lead' : ''}`}>{r.b ?? '-'}</span>
          </div>
        );
      })}
    </div>
  );
}

export function UpcomingList({ games, sport }) {
  if (!games?.length) return <p className="muted small none">Nothing scheduled.</p>;
  return (
    <ul className="upcoming">
      {games.map((g) => (
        <li key={g.id}>
          <span className="muted small">{g.label}</span>
          <TeamLogo src={g.opponent.logo} alt={g.opponent.abbr || ''} size={22} />
          <Link to={`/team/${sport}/${g.opponent.id}`}>{g.home ? 'vs' : '@'} {g.opponent.name}</Link>
          <span className="muted small">{kickoff(g.date)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HubState({ state, retry, what }) {
  if (state.status === 'loading') {
    return (
      <div className="hub-loading">
        <div className="hub-hero skeleton" />
        <div className="game skeleton" />
        <div className="game skeleton" />
      </div>
    );
  }
  return (
    <div className="empty">
      <p>{state.error || `Couldn't load this ${what}.`}</p>
      <button className="btn" onClick={retry}>Retry</button>{' '}
      <Link className="btn" to="/">Back to the board</Link>
    </div>
  );
}
