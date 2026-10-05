// Team colours come from ESPN and some are nearly black, which disappears on
// our dark background. Use the alternate colour (or a neutral) when that happens.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readable(color, alt) {
  const ok = (c) => c && /^#[0-9a-f]{6}$/i.test(c) && luminance(c) > 0.12;
  if (ok(color)) return color;
  if (ok(alt)) return alt;
  return '#9aa59d';
}
