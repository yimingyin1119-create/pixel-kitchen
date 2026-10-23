import { TABS } from '../copy.js';
import { Sprite } from './Sprite.jsx';

export const TAB_IDS = ['today', 'recipes', 'shopping', 'stock', 'me'];
const ICONS = { today: 'pot', recipes: 'book', shopping: 'cart', stock: 'fridge', me: 'hat' };

export function TabBar({ current, onSelect }) {
  return (
    <nav class="tabbar">
      <div class="tabbar-inner" role="tablist">
        {TAB_IDS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} onClick={() => onSelect(t)}>
            <Sprite name={ICONS[t]} scale={2} />
            <span>{TABS[t]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
