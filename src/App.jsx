import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, getPlayerId, forgetPlayer } from './api.js';
import { money } from './format.js';
import { AppContext } from './context.js';
import Onboarding from './components/Onboarding.jsx';
import Board from './components/Board.jsx';
import Picks from './components/Picks.jsx';
import Sharp from './components/Sharp.jsx';
import StatsCard from './components/StatsCard.jsx';
import Toast from './components/Toast.jsx';
import GameHub from './pages/GameHub.jsx';
import TeamHub from './pages/TeamHub.jsx';

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
        <div className="panel error-panel">
          <h2>Lou's booth is closed</h2>
          <p>{loadError}</p>
          <button className="btn primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (profile === undefined) {
    return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  }
  if (profile === null) return <Onboarding onReady={setProfile} />;

  return <Shell profile={profile} setProfile={setProfile} toast={toast} setToast={setToast} />;
}

function Shell({ profile, setProfile, toast, setToast }) {
  const { player, stats, picks } = profile;
  const location = useLocation();
  const navigate = useNavigate();
  const onHome = location.pathname === '/';
  // Mobile only: which section is on screen. 'main' = the current page.
  const [tab, setTab] = useState('main');
  const [askDraft, setAskDraft] = useState(null); // { text, context }

  // Opening a game or team page always shows it, starting at the top.
  useEffect(() => {
    if (location.pathname !== '/') setTab('main');
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const ctx = useMemo(() => ({
    player,
    // context (optional) = { sport, gameId } so Lou gets that game's stats with the question.
    askLou: (text, context = null) => { setAskDraft({ text, context }); setTab('lou'); },
    // After placing a pick from any page: update the bankroll and offer to ask Lou.
    onPlaced: (data, pick) => {
      setProfile(data);
      setToast({
        text: `Locked in: ${pick.team} for ${money(pick.stake)}`,
        tone: 'neutral',
        action: { label: 'Ask Lou', run: () => { setAskDraft({ text: `I just put ${money(pick.stake)} on the ${pick.team}. Thoughts?`, context: pick.context || null }); setTab('lou'); } },
      });
    },
  }), [player, setProfile, setToast]);

  function goTab(id) {
    // "My Picks" lives on the home page, so jump there first.
    if (id === 'picks' && !onHome) navigate('/');
    setTab(id);
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="app" data-tab={tab}>
        <header className="topbar">
          <Link to="/" className="brand">
            <span className="brand-mark">$</span>
            <span className="brand-name">The Sharp</span>
          </Link>
          <div className="topbar-right">
            <span className="player-name">{player.name}</span>
            <span className="bankroll-pill" title="Play-money bankroll">{money(player.bankroll)}</span>
          </div>
        </header>

        <main className="layout">
          <section className="col-main">
            <Routes>
              <Route path="/" element={
                <>
                  <div className="pane pane-main"><Board /></div>
                  <div className="pane pane-picks"><Picks picks={picks} /></div>
                </>
              } />
              <Route path="/game/:sport/:id" element={<div className="pane pane-main hub-pane"><GameHub /></div>} />
              <Route path="/team/:sport/:key" element={<div className="pane pane-main hub-pane"><TeamHub /></div>} />
              <Route path="*" element={
                <div className="pane pane-main empty">
                  <p>Nothing at this address.</p>
                  <Link className="btn" to="/">Back to the board</Link>
                </div>
              } />
            </Routes>
          </section>

          <aside className="col-side pane pane-lou">
            <StatsCard player={player} stats={stats} picks={picks} />
            <Sharp stats={stats} picks={picks} draft={askDraft} onDraftUsed={() => setAskDraft(null)} />
          </aside>
        </main>

        <nav className="tabbar" aria-label="Sections">
          <button className={tab === 'main' ? 'active' : ''} onClick={() => goTab('main')}>
            {onHome ? 'Board' : 'Hub'}
          </button>
          <button className={tab === 'picks' ? 'active' : ''} onClick={() => goTab('picks')}>
            My Picks {stats.pending > 0 && <span className="badge">{stats.pending}</span>}
          </button>
          <button className={tab === 'lou' ? 'active' : ''} onClick={() => goTab('lou')}>Lou</button>
        </nav>

        <p className="disclaimer">Play money only. Nothing here is real gambling. If betting stops being fun: 1-800-GAMBLER.</p>

        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
}
