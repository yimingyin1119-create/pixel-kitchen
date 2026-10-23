import { SPRITES, PALETTE } from './sprites.js';

// `tint` paints every pixel one colour, e.g. a light icon on a red button.
export function Sprite({ name, scale = 3, label, tint }) {
  const rows = SPRITES[name] ?? SPRITES.pot;
  const w = rows[0].length;
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const c = row[x];
      if (c !== '.') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={tint ?? PALETTE[c]} />);
    }
  });
  return (
    <span class="sprite" data-icon={name} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      <svg width={w * scale} height={rows.length * scale} viewBox={`0 0 ${w} ${rows.length}`} shape-rendering="crispEdges">{rects}</svg>
    </span>
  );
}
