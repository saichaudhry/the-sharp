export const fmtPrice = (p) => (p > 0 ? `+${p}` : `${p}`);

export const money = (n, { sign = false } = {}) => {
  const v = Number(n) || 0;
  const s = `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (v < 0) return `-${s}`;
  return sign && v > 0 ? `+${s}` : s;
};

// What a winning bet returns in profit. Mirrors profitOn() in api/settle.js.
export const profitOn = (stake, price) =>
  price > 0 ? stake * (price / 100) : stake * (100 / -price);

// The win probability the price implies (ignores the bookmaker's cut).
export const impliedProb = (price) =>
  price < 0 ? -price / (-price + 100) : 100 / (price + 100);

export function kickoff(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

// "Kansas City Chiefs" -> "Chiefs" for tight spaces.
export const shortName = (team) => team.split(' ').slice(-1)[0];

// A side's Kalshi price in cents (= % chance). Falls back to the American odds.
export const centsOf = (game, team) => game.cents?.[team] ?? Math.round(impliedProb(game.prices[team]) * 100);

// "$100 › $213": what $100 returns if this side wins.
export const payoutOn100 = (price) => Math.round(100 + profitOn(100, price));
