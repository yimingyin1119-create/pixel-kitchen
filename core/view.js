// What the browser is allowed to see. Never includes pin hashes, push tokens or session tokens.
const extras = [];

// Later modules (orders, menu, stats) add fields without view.js importing them.
export function extendView(fn) {
  extras.push(fn);
}

export function view(state, me, ctx) {
  if (!me) return null;
  const out = {
    me: { uid: me.uid, name: me.name, role: me.role, avatar: me.avatar, hasPush: Boolean(me.pushToken) },
    users: state.users.map((u) => ({ uid: u.uid, name: u.name, role: u.role, avatar: u.avatar })),
    recipes: state.recipes.filter((r) => !r.archived),
    orders: state.orders,
    inventory: state.inventory.filter((i) => !i.hidden),
    shopping: state.shopping.filter((s) => !s.removed),
  };
  for (const fn of extras) Object.assign(out, fn(state, me, ctx));
  return out;
}
