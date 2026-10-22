import { TABS } from '../copy.js';

export const DINER_TABS = ['order', 'recipes', 'me'];
export const CHEF_TABS = ['order', 'recipes', 'shopping', 'inventory', 'me'];

export function TabBar({ role, current, onSelect }) {
  const tabs = role === 'chef' ? CHEF_TABS : DINER_TABS;
  return (
    <nav class="tabbar">
      <div class="tabbar-inner" role="tablist">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} onClick={() => onSelect(t)}>{TABS[t]}</button>
        ))}
      </div>
    </nav>
  );
}
