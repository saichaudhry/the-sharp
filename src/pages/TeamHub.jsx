import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.js';
import { kickoff } from '../format.js';
import { FormStrip, Headshot, HubState, HubTabs, InjuryList, TeamLogo, UpcomingList, injuryTone } from '../components/hub.jsx';
import { readable } from '../colors.js';

export default function TeamHub() {
  const { sport, key } = useParams(); // key is an ESPN team id, or a team name
  const { askLou } = useApp();
  const [state, setState] = useState({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const q = /^\d+$/.test(key) ? `id=${key}` : `name=${encodeURIComponent(key)}`;
    api(`team?sport=${sport}&${q}`)
      .then((d) => !cancelled && setState({ status: 'ready', team: d }))
      .catch((err) => !cancelled && setState({ status: 'error', error: err.message }));
    return () => { cancelled = true; };
  }, [sport, key, reload]);

  if (state.status !== 'ready') return <HubState state={state} retry={() => setReload((n) => n + 1)} what="team" />;

  const t = state.team;
  const accent = readable(t.color, t.altColor);
  const played = t.schedule.filter((g) => g.result);
  const upcoming = t.schedule.filter((g) => !g.result);

  const tabs = [
    {
      id: 'overview', label: 'Overview',
      render: () => (
        <>
          <section className="hub-section">
            <h3>Key stats {t.statsSeason && <span className="muted small">· {t.statsSeason} regular season</span>}</h3>
            <div className="stat-tiles">
              {t.record.pointsFor != null && <Tile label="Avg points scored" value={t.record.pointsFor.toFixed(1)} />}
              {t.record.pointsAgainst != null && <Tile label="Avg points allowed" value={t.record.pointsAgainst.toFixed(1)} />}
              {t.keyStats.map((s) => <Tile key={s.key} label={s.label} value={s.value} />)}
            </div>
          </section>
          <section className="hub-section two-col">
            <div>
              <h3>Recent form</h3>
              <FormStrip games={played.slice(-5).reverse()} sport={sport} />
            </div>
            <div>
              <h3>Up next</h3>
              <UpcomingList games={upcoming.slice(0, 4)} sport={sport} />
            </div>
          </section>
        </>
      ),
    },
    {
      id: 'roster', label: 'Roster', count: t.roster.reduce((n, g) => n + g.players.length, 0),
      render: () => <Roster groups={t.roster} />,
    },
    {
      id: 'injuries', label: 'Injuries', count: t.injuries.length,
      render: () => (
        <section className="hub-section">
          <InjuryList injuries={t.injuries.map((p) => ({ ...p, status: p.injury, detail: `#${p.jersey ?? '-'} · ${p.pos}` }))} />
        </section>
      ),
    },
    {
      id: 'schedule', label: 'Schedule',
      render: () => (
        <section className="hub-section">
          <table className="schedule">
            <tbody>
              {t.schedule.map((g) => (
                <tr key={g.id} className={g.result || 'upcoming'}>
                  <td className="muted small">{g.label}</td>
                  <td className="sched-opp">
                    <TeamLogo src={g.opponent.logo} alt={g.opponent.abbr || ''} size={22} />
                    <Link to={`/team/${sport}/${g.opponent.id}`}>{g.home ? 'vs' : '@'} {g.opponent.name}</Link>
                  </td>
                  <td className="sched-res">
                    {g.result
                      ? <><span className={`result-chip ${g.result}`}>{g.result}</span> {g.score}</>
                      : <span className="muted small">{kickoff(g.date)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!t.schedule.length && <p className="muted small none">No schedule published.</p>}
        </section>
      ),
    },
    {
      id: 'stats', label: 'All stats', hidden: !t.allStats.length,
      render: () => <AllStats categories={t.allStats} />,
    },
  ];

  return (
    <div className="hub" style={{ '--c1': accent }}>
      <Link to="/" className="back">‹ Board</Link>

      <header className="hub-hero team-hero">
        <TeamLogo src={t.logo} alt={t.abbr} size={96} />
        <div className="team-hero-main">
          <h1>{t.name}</h1>
          <div className="team-hero-meta">
            {t.record.overall && <span className="big-record">{t.record.overall}</span>}
            {t.standing && <span>{t.standing}</span>}
          </div>
          <div className="team-hero-meta small">
            {t.coach && <span>Head coach <strong>{t.coach.name}</strong>{t.coach.experience ? ` · ${t.coach.experience} yrs` : ''}</span>}
            {t.record.splits.map((s) => <span key={s.label} className="muted">{s.label} {s.value}</span>)}
          </div>
        </div>
        <button className="btn small hero-ask" onClick={() => askLou(`What's your read on the ${t.name} right now?`)}>Ask the desk</button>
      </header>

      <HubTabs tabs={tabs} />

      {t.espnUrl && (
        <p className="muted small source">Data: ESPN. <a href={t.espnUrl} target="_blank" rel="noreferrer">Full team page ›</a></p>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </div>
  );
}

function Roster({ groups }) {
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const shown = groups
    .filter((g) => group === 'all' || g.label === group)
    .map((g) => ({
      ...g,
      players: g.players.filter((p) => `${p.name} ${p.pos} ${p.jersey ?? ''} ${p.college ?? ''}`.toLowerCase().includes(q.toLowerCase())),
    }))
    .filter((g) => g.players.length);

  if (!groups.length) return <p className="muted small none">Roster not available.</p>;

  return (
    <section className="hub-section">
      <div className="roster-tools">
        {groups.length > 1 && <div className="chips">
          <button className={`chip ${group === 'all' ? 'on' : ''}`} onClick={() => setGroup('all')}>All</button>
          {groups.map((g) => (
            <button key={g.label} className={`chip ${group === g.label ? 'on' : ''}`} onClick={() => setGroup(g.label)}>{g.label}</button>
          ))}
        </div>}
        <input className="search" placeholder="Search name, position, #, college" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.map((g) => (
        <div key={g.label} className="roster-group">
          <h4>{g.label} <span className="muted small">{g.players.length}</span></h4>
          <ul className="roster">
            {g.players.map((p) => (
              <li key={p.id} className="player">
                <Headshot src={p.headshot} name={p.name} size={48} />
                <div className="player-main">
                  <div><span className="jersey">#{p.jersey ?? '-'}</span> <strong>{p.name}</strong></div>
                  <div className="muted small">
                    {[p.pos, p.age && `${p.age} yrs`, p.height, p.weight, p.exp != null && (p.exp === 0 ? 'Rookie' : `${p.exp} yr exp`)].filter(Boolean).join(' · ')}
                  </div>
                  {p.college && <div className="muted small">{p.college}</div>}
                </div>
                {p.injury && <span className={`inj-badge ${injuryTone(p.injury)}`}>{p.injury}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!shown.length && <p className="muted small none">No players match “{q}”.</p>}
    </section>
  );
}

function AllStats({ categories }) {
  const [cat, setCat] = useState(categories[0].name);
  const current = categories.find((c) => c.name === cat) || categories[0];
  return (
    <section className="hub-section">
      <div className="chips">
        {categories.map((c) => (
          <button key={c.name} className={`chip ${c.name === current.name ? 'on' : ''}`} onClick={() => setCat(c.name)}>{c.name}</button>
        ))}
      </div>
      <table className="stats-table">
        <thead><tr><th>Stat</th><th>Total</th><th>Per game</th></tr></thead>
        <tbody>
          {current.stats.map((s, i) => (
            <tr key={`${s.label}-${i}`}><td>{s.label}</td><td>{s.value}</td><td className="muted">{s.perGame ?? '-'}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
