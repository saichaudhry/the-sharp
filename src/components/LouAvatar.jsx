// Lou, drawn in SVG. The eyebrows and mouth change with his mood, so the
// face reacts to how your picks are going.
const MOODS = {
  neutral:   { brows: ['M22 34 L34 33', 'M46 33 L58 34'], mouth: 'M32 58 Q40 60 48 58' },
  smug:      { brows: ['M22 32 L34 34', 'M46 31 L58 29'], mouth: 'M31 57 Q42 61 50 54' },
  impressed: { brows: ['M22 30 L34 28', 'M46 28 L58 30'], mouth: 'M33 57 Q40 62 47 57' },
  laughing:  { brows: ['M22 31 L34 30', 'M46 30 L58 31'], mouth: 'M30 55 Q40 68 50 55 Z' },
  thinking:  { brows: ['M22 33 L34 31', 'M46 34 L58 34'], mouth: 'M34 58 L46 58' },
};

export default function LouAvatar({ mood = 'neutral', size = 64 }) {
  const m = MOODS[mood] || MOODS.neutral;
  return (
    <svg className={`lou lou-${mood}`} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="40" className="lou-bg" />
      {/* face */}
      <ellipse cx="40" cy="46" rx="20" ry="23" className="lou-skin" />
      {/* fedora */}
      <path d="M10 27 Q40 19 70 27 Q60 31 40 30 Q20 31 10 27 Z" className="lou-hat" />
      <path d="M22 26 Q24 9 40 9 Q56 9 58 26 Z" className="lou-hat" />
      <path d="M22 23 Q40 27 58 23 L58 26 Q40 30 22 26 Z" className="lou-band" />
      {/* eyes */}
      <circle cx="31" cy="40" r="2.4" className="lou-ink" />
      <circle cx="49" cy="40" r="2.4" className="lou-ink" />
      {m.brows.map((d) => <path key={d} d={d} className="lou-stroke" />)}
      {/* nose + mustache */}
      <path d="M40 41 Q43 48 39 50" className="lou-stroke thin" />
      <path d="M29 53 Q35 49 40 52 Q45 49 51 53 Q45 55 40 54 Q35 55 29 53 Z" className="lou-ink" />
      <path d={m.mouth} className={`lou-stroke ${mood === 'laughing' ? 'lou-mouth-open' : ''}`} />
      {/* toothpick */}
      <path d="M49 58 L60 63" className="lou-pick" />
    </svg>
  );
}

// Picks a mood from the player's record.
export function moodFor(stats, picks) {
  const last = picks
    .filter((p) => p.status !== 'pending')
    .sort((a, b) => new Date(b.settled_at) - new Date(a.settled_at))[0];
  if (!last) return 'neutral';
  if (stats.profit < -300) return 'laughing';
  if (last.status === 'lost') return 'smug';
  if (last.status === 'won') return 'impressed';
  return 'neutral';
}
