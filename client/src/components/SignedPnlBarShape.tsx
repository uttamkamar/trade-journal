/** Custom Recharts Bar shape: rounds top corners for >= 0 and bottom corners for < 0. */
export function SignedPnlBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { pnl: number };
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (width <= 0 || height === 0) return null;
  const pnl = payload?.pnl ?? 0;
  const fill = pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
  const absHeight = Math.abs(height);
  const topY = height < 0 ? y + height : y;
  const r = Math.min(4, width / 2, absHeight / 2);

  if (absHeight < 2) {
    return <rect x={x} y={topY} width={width} height={Math.max(absHeight, 2)} fill={fill} />;
  }

  const d =
    pnl >= 0
      ? `M${x},${topY + absHeight} L${x},${topY + r} Q${x},${topY} ${x + r},${topY} L${x + width - r},${topY} Q${x + width},${topY} ${x + width},${topY + r} L${x + width},${topY + absHeight} Z`
      : `M${x},${topY} L${x + width},${topY} L${x + width},${topY + absHeight - r} Q${x + width},${topY + absHeight} ${x + width - r},${topY + absHeight} L${x + r},${topY + absHeight} Q${x},${topY + absHeight} ${x},${topY + absHeight - r} Z`;

  return <path d={d} fill={fill} />;
}
