// How each character looks and introduces itself. Their actual personalities
// (system prompts) live on the server in api/_lib/persona.js; the ids match.
export const PERSONAS = [
  {
    id: 'lou',
    name: 'Lou',
    full: 'Lou "The Sharp" Marchetti',
    title: 'Retired Vegas oddsmaker',
    color: '#e8b64c',
    face: { skin: '#e9b98f', hat: 'fedora', mustache: true, toothpick: true },
    hello: "Sit down, kid. I remember every bet you make.",
  },
  {
    id: 'quant',
    name: 'The Quant',
    full: 'Dr. Priya "The Quant" Raman',
    title: 'Ex hedge-fund quant',
    color: '#179be7',
    face: { skin: '#b07a52', hair: 'bun', glasses: 'round' },
    hello: "Every price is a probability. Ask me where it's wrong.",
  },
  {
    id: 'hype',
    name: 'Hype',
    full: 'Marcus "Hype" Dawkins',
    title: 'Ex linebacker, radio host',
    color: '#ee3e3e',
    face: { skin: '#7a4a2b', hat: 'cap', beard: true },
    hello: "LET'S GO! Who we riding today?",
  },
  {
    id: 'contrarian',
    name: 'The Fade',
    full: 'Vera "The Fade" Kowalski',
    title: 'Retired bookie',
    color: '#0cc565',
    face: { skin: '#f1c9a5', hair: 'bob', glasses: 'shades', earrings: true },
    hello: "Whatever the crowd likes, I'm fading.",
  },
];

export const personaById = (id) => PERSONAS.find((p) => p.id === id) || PERSONAS[0];
