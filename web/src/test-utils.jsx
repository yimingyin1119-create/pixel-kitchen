// Test helpers only.
import { vi } from 'vitest';
import { render } from '@testing-library/preact';
import { AppContext } from './store.js';

export function makeView(role = 'diner', over = {}) {
  const me = role === 'chef'
    ? { uid: 'c1', name: '大厨', role: 'chef', avatar: '', hasPush: true }
    : { uid: 'd1', name: '小明', role: 'diner', avatar: '', hasPush: true };
  return {
    me,
    users: [{ uid: 'c1', name: '大厨', role: 'chef' }, { uid: 'd1', name: '小明', role: 'diner' }],
    recipes: [
      { uid: 'r1', name: '红烧肉', zone: 'signature', baseServings: 2, ingredients: [], steps: [], archived: false },
      { uid: 'r2', name: '葱油拌面', zone: 'signature', baseServings: 1, ingredients: [], steps: [], archived: false },
      { uid: 'r3', name: '佛跳墙', zone: 'wish', baseServings: 4, ingredients: [], steps: [], archived: false },
    ],
    requests: [],
    availability: { r1: { makeable: true, missing: [] }, r2: { makeable: false, missing: ['小葱'] } },
    doneCounts: { r1: 3 },
    inventory: [],
    shopping: [],
    ...over,
  };
}

export function renderWithApp(ui, { view = makeView(), act } = {}) {
  const actFn = act ?? vi.fn(async () => view);
  const value = {
    view, me: view.me, token: 't', act: actFn, refresh: vi.fn(), signOut: vi.fn(), syncing: false, offline: false,
    highlight: null, setHighlight: vi.fn(),
  };
  const utils = render(<AppContext.Provider value={value}>{ui}</AppContext.Provider>);
  return { ...utils, act: actFn, refresh: value.refresh };
}
