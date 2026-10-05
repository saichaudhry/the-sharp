// One SVG face, dressed differently per character (hat, hair, glasses...).
// The eyebrows and mouth change with mood, so faces react to your results.
const MOODS = {
  neutral:   { brows: ['M22 34 L34 33', 'M46 33 L58 34'], mouth: 'M32 58 Q40 60 48 58' },
  smug:      { brows: ['M22 32 L34 34', 'M46 31 L58 29'], mouth: 'M31 57 Q42 61 50 54' },
  impressed: { brows: ['M22 30 L34 28', 'M46 28 L58 30'], mouth: 'M33 57 Q40 62 47 57' },
  laughing:  { brows: ['M22 31 L34 30', 'M46 30 L58 31'], mouth: 'M30 55 Q40 68 50 55 Z' },
  thinking:  { brows: ['M22 33 L34 31', 'M46 34 L58 34'], mouth: 'M34 58 L46 58' },
};

export default function Face({ persona, mood = 'neutral', size = 48 }) {
  const f = persona.face;
  const m = MOODS[mood] || MOODS.neutral;
  const ink = '#1c140f';
  return (
    <svg className={`face face-${mood}`} width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="40" fill={persona.color} opacity="0.18" />
      <circle cx="40" cy="40" r="39" fill="none" stroke={persona.color} strokeOpacity="0.5" />

      {f.hair === 'bob' && <path d="M17 46 Q14 16 40 15 Q66 16 63 46 L58 50 Q58 26 40 25 Q22 26 22 50 Z" fill="#2a1a12" />}
      {f.hair === 'bun' && <><circle cx="40" cy="15" r="7" fill="#1a1110" /><path d="M20 40 Q20 20 40 20 Q60 20 60 40 Q56 28 40 27 Q24 28 20 40 Z" fill="#1a1110" /></>}

      <ellipse cx="40" cy="46" rx="20" ry="23" fill={f.skin} />

      {f.hat === 'fedora' && <>
        <path d="M10 27 Q40 19 70 27 Q60 31 40 30 Q20 31 10 27 Z" fill="#2b2b2b" />
        <path d="M22 26 Q24 9 40 9 Q56 9 58 26 Z" fill="#2b2b2b" />
        <path d="M22 23 Q40 27 58 23 L58 26 Q40 30 22 26 Z" fill={persona.color} />
      </>}
      {f.hat === 'cap' && <>
        <path d="M20 30 Q20 12 40 12 Q60 12 60 30 Z" fill={persona.color} />
        <path d="M18 30 Q40 25 62 30 L62 32 Q40 28 18 32 Z" fill="#7a1b1b" />
      </>}

      <circle cx="31" cy="40" r="2.4" fill={ink} />
      <circle cx="49" cy="40" r="2.4" fill={ink} />
      {f.glasses === 'round' && <g fill="none" stroke={ink} strokeWidth="1.8"><circle cx="31" cy="40" r="6" /><circle cx="49" cy="40" r="6" /><path d="M37 40 L43 40" /></g>}
      {f.glasses === 'shades' && <g fill={ink}><rect x="23" y="35" width="15" height="9" rx="3" /><rect x="42" y="35" width="15" height="9" rx="3" /><rect x="37" y="38" width="6" height="2" /></g>}

      {m.brows.map((d) => <path key={d} d={d} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />)}
      <path d="M40 41 Q43 48 39 50" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />

      {f.beard && <path d="M22 50 Q24 68 40 70 Q56 68 58 50 Q54 62 40 63 Q26 62 22 50 Z" fill="#1c120c" />}
      {f.mustache && <path d="M29 53 Q35 49 40 52 Q45 49 51 53 Q45 55 40 54 Q35 55 29 53 Z" fill={ink} />}
      <path d={m.mouth} fill={mood === 'laughing' ? '#5a1f1f' : 'none'} stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      {f.toothpick && <path d="M49 58 L60 63" stroke="#c9a46b" strokeWidth="2" strokeLinecap="round" className="toothpick" />}
      {f.earrings && <><circle cx="20" cy="52" r="2.2" fill={persona.color} /><circle cx="60" cy="52" r="2.2" fill={persona.color} /></>}
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
