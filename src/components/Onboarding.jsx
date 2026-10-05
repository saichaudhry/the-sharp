import { useState } from 'react';
import { api, newPlayerId, forgetPlayer } from '../api.js';
import Face from './Face.jsx';
import { PERSONAS } from '../personas.js';

export default function Onboarding({ onReady }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    newPlayerId();
    try {
      onReady(await api('me', { method: 'POST', body: { name: name.trim() } }));
    } catch (err) {
      forgetPlayer();
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="center-screen onboarding">
      <div className="panel onboard-card">
        <div className="onboard-faces">{PERSONAS.map((p) => <Face key={p.id} persona={p} size={64} />)}</div>
        <span className="eyebrow">Play-money sports picks</span>
        <h1>THE SHARP</h1>
        <p className="lede">
          Pick winners at live Kalshi prices with <strong>$1,000 in play money</strong>.
          Four AI handicappers (an oddsmaker, a quant, a hype man and a contrarian) argue every game and remember every pick you make.
        </p>
        <form onSubmit={submit} className="onboard-form">
          <label htmlFor="name">What should the desk call you?</label>
          <div className="row">
            <input
              id="name"
              autoFocus
              maxLength={24}
              autoComplete="nickname"
              placeholder="e.g. Parlay Pete"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn primary" disabled={!name.trim() || busy}>
              {busy ? 'Opening…' : 'Pull up a chair'}
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
        <p className="fine">Play money only, not real gambling. Your progress is saved to this browser.</p>
      </div>
    </div>
  );
}
