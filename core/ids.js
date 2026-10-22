// Deterministic for a given ctx so tests can predict ids; ctx.rand comes from n8n's Crypto node.
export function newId(ctx, prefix) {
  const k = ctx.seq ?? 0;
  ctx.seq = k + 1;
  const chunk = ctx.rand.slice((k * 6) % 60, ((k * 6) % 60) + 6);
  return `${prefix}_${Date.parse(ctx.now).toString(36)}${chunk}${k}`;
}
