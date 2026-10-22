// Column types of every n8n Data Table. `json` columns are stored as strings.
// n8n reserves id / createdAt / updatedAt, so rows are keyed by `uid`.
export const TABLES = {
  pk_users: {
    uid: 'string', name: 'string', role: 'string', pinSalt: 'string', pinHash: 'string',
    pushToken: 'string', avatar: 'string', failedLogins: 'number', lockedUntilIso: 'string', createdIso: 'string',
  },
  pk_sessions: { uid: 'string', userUid: 'string', expiresIso: 'string' },
  pk_recipes: {
    uid: 'string', name: 'string', zone: 'string', imageUrl: 'string', sourceUrl: 'string',
    baseServings: 'number', ingredients: 'json', steps: 'json', tags: 'json', wishVotes: 'json',
    createdBy: 'string', createdIso: 'string', archived: 'boolean',
  },
  pk_inventory: {
    uid: 'string', name: 'string', aliases: 'json', kind: 'string', qty: 'number', unit: 'string',
    lowThreshold: 'number', status: 'string', expiresOn: 'string', stockedIso: 'string', hidden: 'boolean',
  },
  pk_orders: {
    uid: 'string', userUid: 'string', takerUid: 'string', items: 'json', servings: 'number', wantedDate: 'string',
    meal: 'string', wantedTime: 'string', note: 'string', status: 'string',
    needs: 'json', shortages: 'json', createdIso: 'string', updatedIso: 'string',
  },
  pk_shopping: {
    uid: 'string', name: 'string', inventoryUid: 'string', qty: 'number', unit: 'string', reasons: 'json',
    done: 'boolean', boughtQty: 'number', doneIso: 'string', removed: 'boolean',
  },
  pk_menu: { uid: 'string', recipeUids: 'json', updatedIso: 'string' },
};

export const STATE_KEYS = {
  pk_users: 'users', pk_sessions: 'sessions', pk_recipes: 'recipes', pk_inventory: 'inventory',
  pk_orders: 'orders', pk_shopping: 'shopping', pk_menu: 'menu',
};

const DEFAULTS = { string: '', number: 0, boolean: false, json: [] };

export function serialize(table, row) {
  const out = {};
  for (const [col, type] of Object.entries(TABLES[table])) {
    const v = row[col] ?? DEFAULTS[type];
    out[col] = type === 'json' ? JSON.stringify(v) : v;
  }
  return out;
}

export function deserialize(table, raw) {
  if (!raw || !raw.uid) return null;
  const out = {};
  for (const [col, type] of Object.entries(TABLES[table])) {
    const v = raw[col];
    if (type === 'json') {
      try { out[col] = typeof v === 'string' && v ? JSON.parse(v) : (v ?? []); } catch { out[col] = []; }
    } else {
      out[col] = v ?? DEFAULTS[type];
    }
  }
  return out;
}

export function stateFromTables(rawByTable) {
  const state = {};
  for (const [table, key] of Object.entries(STATE_KEYS)) {
    state[key] = (rawByTable[table] ?? []).map((r) => deserialize(table, r)).filter(Boolean);
  }
  return state;
}
