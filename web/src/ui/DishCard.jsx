import { Sprite } from './Sprite.jsx';
import { PixelBox, Button } from './PixelBox.jsx';

const ICONS = ['pot', 'bowl', 'tomato', 'egg', 'fish', 'leaf'];

export function dishIcon(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return ICONS[h % ICONS.length];
}

export function DishCard({ recipe, count, missing = [], selected, onToggle }) {
  return (
    <PixelBox class="dish">
      <div class="row">
        <Sprite name={dishIcon(recipe.name)} />
        <div style={{ flex: 1 }}>
          <div class="dish-name" data-testid="dish-name">{recipe.name}</div>
          {count > 0 && <div class="muted">点过 {count} 次</div>}
          {missing.length > 0 && <span class="tag miss">缺：{missing.join('、')}</span>}
        </div>
        <Button variant={selected ? 'green' : ''} onClick={onToggle} aria-pressed={selected}>
          {selected ? '已选' : '点这道'}
        </Button>
      </div>
    </PixelBox>
  );
}
