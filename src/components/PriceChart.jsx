// Each side's Kalshi price over the last few days, as two SVG lines (no chart library).
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const W = 520;
const H = 180;
const PAD = { l: 34, r: 74, t: 14, b: 22 };

export default function PriceChart({ game, colors }) {
  const [series, setSeries] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSeries(null);
    api(`history?sport=${game.sport}&id=${encodeURIComponent(game.id)}`)
      .then((d) => !cancelled && setSeries(d.series))
      .catch(() => !cancelled && setSeries({}));
    return () => { cancelled = true; };
  }, [game.sport, game.id]);

  if (!series) return <div className="chart-box skeleton" />;
  const sides = [game.away, game.home].filter((t) => series[t]?.length > 1);
  if (!sides.length) return <div className="chart-box empty-chart muted small">No price history yet.</div>;

  const all = sides.flatMap((t) => series[t]);
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const lo = Math.max(0, Math.min(...all.map((p) => p.c)) - 4);
  const hi = Math.min(100, Math.max(...all.map((p) => p.c)) + 4);
  const x = (t) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (c) => PAD.t + (1 - (c - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = [lo, (lo + hi) / 2, hi].map(Math.round);

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - box.left) / box.width * W - PAD.l) / (W - PAD.l - PAD.r) * (t1 - t0);
    setHover(Math.max(t0, Math.min(t1, t)));
  }
  const at = (team) => {
    const pts = series[team];
    if (hover == null) return pts.at(-1);
    return pts.reduce((best, p) => (Math.abs(p.t - hover) < Math.abs(best.t - hover) ? p : best), pts[0]);
  };

  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img"
        aria-label={`Kalshi price history: ${sides.map((t) => `${t} ${series[t].at(-1).c}%`).join(', ')}`}>
        {ticks.map((c) => (
          <g key={c}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(c)} y2={y(c)} className="grid" />
            <text x={PAD.l - 6} y={y(c) + 4} className="axis y" textAnchor="end">{c}%</text>
          </g>
        ))}
        {sides.map((team, i) => {
          const pts = series[team];
          const other = sides[1 - i] && at(sides[1 - i]);
          const d = pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ');
          const cur = at(team);
          return (
            <g key={team}>
              <path d={d} fill="none" stroke={colors[i]} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <circle cx={x(cur.t)} cy={y(cur.c)} r="4" fill={colors[i]} />
              <text x={x(cur.t) + 8} y={y(cur.c) + 4 + (other && Math.abs(y(other.c) - y(cur.c)) < 16 ? (cur.c >= other.c ? -8 : 8) : 0)} className="chart-tag" fill={colors[i]}>
                {game.teams?.[team]?.abbr || team.split(' ').pop()} {cur.c}%
              </text>
            </g>
          );
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="cursor" />}
        <text x={PAD.l} y={H - 4} className="axis">{new Date(t0).toLocaleDateString([], { month: 'short', day: 'numeric' })}</text>
        <text x={W - PAD.r} y={H - 4} className="axis" textAnchor="end">
          {hover != null ? new Date(hover).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' }) : 'now'}
        </text>
      </svg>
    </div>
  );
}
