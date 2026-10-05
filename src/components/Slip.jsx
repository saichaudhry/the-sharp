// The bet slip. Docked in the right rail on desktop, a bottom sheet on phones.
// Any page can open it with select({ game, team }) from the app context.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../context.js';
import { fmtPrice, money, profitOn, kickoff, centsOf } from '../format.js';
import { TeamLogo } from './hub.jsx';

const QUICK = [10, 25, 50, 100];
const MAX_STAKE = 500; // matches the server check in api/picks.js

export default function Slip() {
  const { player, selection, select, onPlaced } = useApp();
  const [stake, setStake] = useState('25');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { setError(null); if (selection) inputRef.current?.focus(); }, [selection]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && select(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  if (!selection) {
    return (
      <div className="slip slip-empty">
        <div className="slip-empty-icon" aria-hidden="true">＋</div>
        <strong>Bet slip empty</strong>
        <span className="muted small">Tap a price on the board to add a pick.</span>
      </div>
    );
  }

  const { game, team } = selection;
  const bankroll = Number(player.bankroll);
  const price = game.prices[team];
  const cents = centsOf(game, team);
  const opponent = team === game.home ? game.away : game.home;
  const amount = Number(stake);
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= Math.min(bankroll, MAX_STAKE);
  const toWin = valid ? profitOn(amount, price) : 0;

  let hint = null;
  if (stake !== '' && !valid) {
    if (amount > bankroll) hint = `You only have ${money(bankroll)}.`;
    else if (amount > MAX_STAKE) hint = `Max stake is ${money(MAX_STAKE)}.`;
    else hint = 'Minimum stake is $1.';
  }

  async function submit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api('picks', { method: 'POST', body: { sport: game.sport, eventId: game.id, team, stake: amount } });
      select(null);
      onPlaced(data, { team, stake: amount, context: { sport: game.sport, gameId: game.id } });
    } catch (err) {
      setError(err.status === 409 ? 'That game just went off the board (it may have started).' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="slip-backdrop" onClick={() => select(null)} />
      <form className="slip" onSubmit={submit} aria-label="Bet slip">
        <div className="slip-top">
          <span className="eyebrow">Bet slip</span>
          <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="Close">×</button>
        </div>

        <div className="slip-pick">
          <TeamLogo src={game.teams?.[team]?.logo} alt={game.teams?.[team]?.abbr || team} size={40} />
          <div className="slip-pick-main">
            <strong>{team}</strong>
            <span className="muted small">to win vs {opponent} · {kickoff(game.commence)}</span>
          </div>
          <div className="slip-price">
            <span className="pct">{cents}%</span>
            <span className="muted small">{fmtPrice(price)}</span>
          </div>
        </div>

        <label htmlFor="stake" className="small muted">Stake (play money)</label>
        <div className="stake-row">
          <span className="dollar">$</span>
          <input id="stake" ref={inputRef} inputMode="decimal" value={stake}
            onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ''))} />
        </div>
        <div className="chips">
          {QUICK.map((q) => (
            <button type="button" key={q} className="chip" disabled={q > bankroll} onClick={() => setStake(String(q))}>${q}</button>
          ))}
          <button type="button" className="chip" onClick={() => setStake(String(Math.floor(Math.min(bankroll, MAX_STAKE))))}>Max</button>
        </div>

        <div className="payout-line">
          <span>{money(valid ? amount : 0)}</span>
          <span className="arrow" aria-hidden="true">›</span>
          <strong>{money(valid ? amount + toWin : 0)}</strong>
          <span className="muted small">if {team.split(' ').pop()} win</span>
        </div>
        <p className="muted small slip-note">
          Kalshi traders give this a {cents}% chance. Profit if it hits: <strong className="win">{money(toWin)}</strong>.
        </p>

        {(hint || error) && <p className="form-error" role="alert">{error || hint}</p>}
        <button className="btn primary block" disabled={!valid || busy}>{busy ? 'Placing…' : 'Place pick'}</button>
      </form>
    </>
  );
}
