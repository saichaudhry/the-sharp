import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, getPlayerId, forgetPlayer } from './api.js';
import { money } from './format.js';
import { AppContext } from './context.js';
import Onboarding from './components/Onboarding.jsx';
import Board, { SPORTS } from './components/Board.jsx';
import Desk from './components/Desk.jsx';
import Slip from './components/Slip.jsx';
import Ticker from './components/Ticker.jsx';
import Toast from './components/Toast.jsx';
import GameHub from './pages/GameHub.jsx';
import TeamHub from './pages/TeamHub.jsx';
import PicksPage from './pages/PicksPage.jsx';

export default function App() {
  // profile = { player, stats, picks } from the API. undefined = still loading, null = new visitor.
  const [profile, setProfile] = useState(undefined);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    if (!getPlayerId()) return setProfile(null);
    try {
      // Settle finished games first, so returning players see fresh results.
      // If settling fails for a server-side reason, still load the profile.
      const data = await api('settle', { method: 'POST' }).catch((err) => {
        if (err.status >= 500) return api('me');
        throw err;
      });
      setProfile(data);
      const n = data.settled?.length;
      if (n) {
        const net = data.settled.reduce((s, p) => s + Number(p.payout) - Number(p.stake), 0);
        setToast({ text: `${n} pick${n > 1 ? 's' : ''} settled while you were gone: ${money(net, { sign: true })}`, tone: net >= 0 ? 'win' : 'loss' });
      }
    } catch (err) {
      if (err.status === 404 || err.status === 401) {
        forgetPlayer();
        return setProfile(null);
      }
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loadError) {
    return (
      <div className="center-screen">
        <div className="card error-panel">
          <h2>The desk is closed</h2>
          <p>{loadError}</p>
          <button className="btn primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (profile === undefined) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  if (profile === null) return <Onboarding onReady={setProfile} />;
  return <Shell profile={profile} setProfile={setProfile} toast={toast} setToast={setToast} />;
}

const REPO = 'https://github.com/saichaudhry/the-sharp';
const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const SPORT_KEY = 'the-sharp:sport';
const savedSport = () => {
  try { return SPORTS.find((s) => s.id === localStorage.getItem(SPORT_KEY))?.id || 'nfl'; } catch { return 'nfl'; }
};

function Shell({ profile, setProfile, toast, setToast }) {
  const { player, stats, picks } = profile;
  const location = useLocation();
  const navigate = useNavigate();
  const [sport, setSportState] = useState(savedSport);
  const [selection, setSelection] = useState(null); // { game, team } in the bet slip
  const [askDraft, setAskDraft] = useState(null);   // { text, context, persona } for the desk
  const onDesk = location.pathname === '/desk';

  useEffect(() => { window.scrollTo(0, 0); document.querySelector('.main')?.scrollTo(0, 0); }, [location.pathname]);

  const ctx = useMemo(() => {
    const askLou = (text, context = null, persona = null) => {
      setAskDraft({ text, context, persona });
      if (window.matchMedia('(max-width: 900px)').matches) navigate('/desk');
    };
    return {
      player, profile, setProfile, sport, selection,
      notify: setToast,
      select: setSelection,
      setSport: (id) => {
        setSportState(id);
        try { localStorage.setItem(SPORT_KEY, id); } catch { /* ignore */ }
        navigate('/');
      },
      askLou,
      // After placing a pick from any page: update the bankroll and offer a reaction.
      onPlaced: (data, pick) => {
        setProfile(data);
        setToast({
          text: `Locked in: ${pick.team} for ${money(pick.stake)}`,
          tone: 'neutral',
          action: { label: 'Ask the desk', run: () => askLou(`I just put ${money(pick.stake)} on the ${pick.team}. Thoughts?`, pick.context) },
        });
      },
    };
  }, [player, profile, setProfile, sport, selection, setToast, navigate]);

  return (
    <AppContext.Provider value={ctx}>
      <div className={`app ${onDesk ? 'route-desk' : ''} ${selection ? 'has-slip' : ''}`}>
        <Ticker />

        <header className="topbar">
          <Link to="/" className="brand"><span className="brand-mark">S</span><span className="wordmark">THE SHARP</span></Link>
          <nav className="topnav">
            <NavLink to="/" end>Board</NavLink>
            <NavLink to="/picks">My Picks{stats.pending > 0 && <span className="badge">{stats.pending}</span>}</NavLink>
          </nav>
          <div className="topbar-right">
            <a href={REPO} target="_blank" rel="noreferrer" className="gh-icon" aria-label="Source code on GitHub" title="Source on GitHub"><GitHubIcon /></a>
            <span className="player-name">{player.name}</span>
            <Link to="/picks" className="bankroll-pill" title="Play-money bankroll">{money(player.bankroll)}</Link>
          </div>
        </header>

        <div className="frame">
          <aside className="sidebar" aria-label="Sports">
            {SPORTS.map((s) => (
              <button key={s.id} className={`side-link ${sport === s.id && location.pathname === '/' ? 'active' : ''}`} onClick={() => ctx.setSport(s.id)}>
                <span className="side-icon" aria-hidden="true">{s.icon}</span>{s.label}
              </button>
            ))}
            <div className="side-sep" />
            <NavLink to="/picks" className="side-link"><span className="side-icon" aria-hidden="true">📈</span>My Picks</NavLink>
            <div className="side-foot">
              <a href={REPO} target="_blank" rel="noreferrer" className="gh-link"><GitHubIcon /> Source on GitHub</a>
              <p>Play money only · 1-800-GAMBLER</p>
            </div>
          </aside>

          <main className="main">
            <Routes>
              <Route path="/" element={<Board />} />
              <Route path="/desk" element={<Board />} />
              <Route path="/picks" element={<PicksPage />} />
              <Route path="/game/:sport/:id" element={<GameHub />} />
              <Route path="/team/:sport/:key" element={<TeamHub />} />
              <Route path="*" element={<div className="empty"><p>Nothing at this address.</p><Link className="btn" to="/">Back to the board</Link></div>} />
            </Routes>
          </main>

          <aside className="rail" aria-label="Bet slip and the desk">
            <Slip />
            <Desk stats={stats} picks={picks} draft={askDraft} onDraftUsed={() => setAskDraft(null)} />
          </aside>
        </div>

        <nav className="tabbar" aria-label="Sections">
          <NavLink to="/" end>Board</NavLink>
          <NavLink to="/picks">Picks{stats.pending > 0 && <span className="badge">{stats.pending}</span>}</NavLink>
          <NavLink to="/desk">The Desk</NavLink>
        </nav>

        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
}
