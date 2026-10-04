import { useCallback, useEffect, useState } from 'react';
import { api, getPlayerId, forgetPlayer } from './api.js';
import { money } from './format.js';
import Onboarding from './components/Onboarding.jsx';
import Board from './components/Board.jsx';
import Picks from './components/Picks.jsx';
import Sharp from './components/Sharp.jsx';
import StatsCard from './components/StatsCard.jsx';
import Toast from './components/Toast.jsx';

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'picks', label: 'My Picks' },
  { id: 'lou', label: 'Lou' },
];

export default function App() {
  // profile = { player, stats, picks } from the API. undefined = still loading, null = new visitor.
  const [profile, setProfile] = useState(undefined);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('board');
  const [toast, setToast] = useState(null);
  const [askDraft, setAskDraft] = useState('');

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

  const askLou = (text) => {
    setAskDraft(text);
    setTab('lou');
  };

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

  const { player, stats, picks } = profile;

  return (
    <div className="app" data-tab={tab}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">$</span>
          <span className="brand-name">The Sharp</span>
        </div>
        <div className="topbar-right">
          <span className="player-name">{player.name}</span>
          <span className="bankroll-pill" title="Play-money bankroll">
            {money(player.bankroll)}
          </span>
        </div>
      </header>

      <main className="layout">
        <section className="col-main">
          <div className="pane pane-board">
            <Board
              bankroll={Number(player.bankroll)}
              onPlaced={(data, pick) => {
                setProfile(data);
                setToast({
                  text: `Locked in: ${pick.team} for ${money(pick.stake)}`,
                  tone: 'neutral',
                  action: { label: 'Ask Lou', run: () => askLou(`I just put ${money(pick.stake)} on the ${pick.team}. Thoughts?`) },
                });
              }}
            />
          </div>
          <div className="pane pane-picks">
            <Picks picks={picks} />
          </div>
        </section>

        <aside className="col-side pane pane-lou">
          <StatsCard player={player} stats={stats} picks={picks} />
          <Sharp stats={stats} picks={picks} draft={askDraft} onDraftUsed={() => setAskDraft('')} />
        </aside>
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'picks' && stats.pending > 0 && <span className="badge">{stats.pending}</span>}
          </button>
        ))}
      </nav>

      <p className="disclaimer">Play money only. Nothing here is real gambling. If betting stops being fun: 1-800-GAMBLER.</p>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
