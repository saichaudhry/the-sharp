// Team colours come from ESPN and some are nearly black, which disappears on
// our dark background. Use the alternate colour (or a neutral) when that happens.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Two teams with near-identical colours (Lions/Panthers blue) can't be told
// apart in the comparison bars, so swap the second one for its alternate.
export function distinct(first, second, secondAlt) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  if (dist(first, second) > 90) return second;
  const alt = readable(secondAlt, null);
  return alt !== '#9aa59d' && dist(first, alt) > 90 ? alt : '#e8efe9';
}

export function readable(color, alt) {
  const ok = (c) => c && /^#[0-9a-f]{6}$/i.test(c) && luminance(c) > 0.12;
  if (ok(color)) return color;
  if (ok(alt)) return alt;
  return '#9aa59d';
}
