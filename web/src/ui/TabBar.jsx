import { TABS } from '../copy.js';

export const TAB_IDS = ['today', 'recipes', 'shopping', 'stock', 'me'];

export function TabBar({ current, onSelect }) {
  return (
    <nav class="tabbar">
      <div class="tabbar-inner" role="tablist">
        {TAB_IDS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} onClick={() => onSelect(t)}>{TABS[t]}</button>
        ))}
      </div>
    </nav>
  );
}
