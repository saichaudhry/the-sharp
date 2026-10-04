import { money } from '../format.js';
import ProfitChart from './ProfitChart.jsx';

export default function StatsCard({ player, stats, picks }) {
  return (
    <div className="stats-card">
      <div className="stats-row">
        <Stat label="Bankroll" value={money(player.bankroll)} />
        <Stat label="Record" value={`${stats.won}-${stats.lost}${stats.push ? `-${stats.push}` : ''}`} />
        <Stat
          label="Profit"
          value={money(stats.profit, { sign: true })}
          tone={stats.profit > 0 ? 'win' : stats.profit < 0 ? 'loss' : ''}
        />
        <Stat label="ROI" value={`${stats.roi}%`} tone={stats.roi > 0 ? 'win' : stats.roi < 0 ? 'loss' : ''} />
      </div>
      <ProfitChart picks={picks} />
      {player.rebuys > 0 && (
        <p className="muted small rebuys">Busted {player.rebuys}× · Lou has not forgotten.</p>
      )}
    </div>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{value}</span>
    </div>
  );
}
