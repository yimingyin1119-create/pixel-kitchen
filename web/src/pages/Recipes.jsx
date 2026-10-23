import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { round1 } from '../../../core/units.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { Sprite } from '../ui/Sprite.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { Toast } from '../ui/Toast.jsx';
import { RecipeSheet } from '../ui/RecipeSheet.jsx';
import { RequestSheet } from '../ui/RequestSheet.jsx';
import { dishIcon } from '../lib/dishIcon.js';
import { cookLine, doneRequests } from '../lib/meals.js';
import { MEALS } from '../copy.js';
import { dateLabel } from '../lib/time.js';

function amount(ing, n, base) {
  if (ing.qty === null || ing.qty === undefined) return `${ing.name} ${ing.unit || '适量'}`;
  return `${ing.name} ${round1((ing.qty * n) / (base || 2))} ${ing.unit}`;
}

function RecipeDetail({ recipe, onClose, onEdit, onWant, onDeleted }) {
  const { view, act } = useApp();
  const [n, setN] = useState(recipe.baseServings || 2);
  const [confirming, setConfirming] = useState(false);
  const [run, pending, error] = useAction();
  const author = recipe.createdBy ? view.users.find((u) => u.uid === recipe.createdBy)?.name ?? '' : '预设';
  const missing = view.availability[recipe.uid]?.missing ?? [];
  const recent = doneRequests(view.requests).filter((r) => r.items.some((i) => i.recipeUid === recipe.uid)).slice(0, 3);

  const remove = () => run(async () => {
    const data = await act('recipes.archive', { uid: recipe.uid }, {
      optimistic: (v) => ({ ...v, recipes: v.recipes.filter((r) => r.uid !== recipe.uid) }),
    });
    if (data) onDeleted(`「${recipe.name}」删掉了`);
  });

  return (
    <Sheet title={recipe.name} onClose={onClose}>
      {author && <p class="muted">{author}</p>}
      <div class="row">
        <Button variant="secondary" aria-label="减一人" onClick={() => setN(Math.max(1, n - 1))}>−</Button>
        <span style={{ minWidth: '56px', textAlign: 'center' }}>{n} 人份</span>
        <Button variant="secondary" aria-label="加一人" onClick={() => setN(Math.min(20, n + 1))}>+</Button>
      </div>
      <div class="section-title">食材</div>
      {recipe.ingredients.length === 0 && <p class="muted">还没写食材</p>}
      <ul class="plain-list">
        {recipe.ingredients.map((ing, i) => (
          <li key={i} data-testid={`ing-${ing.name}`} class="ing-row">
            <span>{amount(ing, n, recipe.baseServings)}</span>
            {missing.includes(ing.name) && <span class="tag miss">缺</span>}
          </li>
        ))}
      </ul>
      <div class="section-title">步骤</div>
      <ol class="plain-list">{recipe.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {recent.length > 0 && <>
        <div class="section-title"><Sprite name="scroll" scale={2} />最近做过</div>
        <ul class="plain-list">
          {recent.map((r) => (
            <li key={r.uid} class="ing-row" data-testid="recent-cook">
              <span>{dateLabel(r.wantedDate)} {MEALS[r.meal]}</span><span class="muted">{cookLine(r, view.users, true)}</span>
            </li>
          ))}
        </ul>
      </>}
      {confirming ? (
        <PixelBox class="page">
          <p>确定删除「{recipe.name}」？做过的记录会保留。</p>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirming(false)}>先不删</Button>
            <Button disabled={pending} onClick={remove}>确定删除</Button>
          </div>
        </PixelBox>
      ) : (
        <div class="row" style={{ justifyContent: 'space-between', marginTop: '12px' }}>
          <Button variant="secondary" onClick={() => setConfirming(true)}>删除</Button>
          <div class="row">
            <Button variant="secondary" onClick={onEdit}>改</Button>
            <Button onClick={onWant}>想吃这道</Button>
          </div>
        </div>
      )}
      {error && <p class="error" role="alert">{error}</p>}
    </Sheet>
  );
}

export function Recipes() {
  const { view, highlight } = useApp();
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(null); // {type:'new'|'edit'|'detail'|'want', recipe?}
  const [toast, setToast] = useState('');

  const count = (r) => view.doneCounts[r.uid] ?? 0;
  const live = view.recipes.filter((r) => !r.archived);
  const list = live
    .filter((r) => r.name.includes(search.trim()))
    .sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name, 'zh'));
  const done = (msg) => { setSheet(null); setToast(msg); };

  return (
    <div>
      <Header title="菜谱" subtitle={`${live.length} 道菜`} icon="book" />
      <Toast text={toast} onDone={() => setToast('')} />
      <div class="page">
        <Button class="big-btn icon-btn" onClick={() => setSheet({ type: 'new' })}><Sprite name="book" scale={2} tint="#fff6e6" />新菜谱</Button>
        <input class="px-input" placeholder="搜菜名" value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
        {list.map((r) => {
          const missing = view.availability[r.uid]?.missing ?? [];
          return (
            <PixelBox key={r.uid} class={`dish ${highlight === r.uid ? 'flash' : ''}`}>
              <div class="row">
                <Sprite name={dishIcon(r)} />
                <div style={{ flex: 1 }}>
                  <button type="button" class="name-btn" data-testid="recipe-name" onClick={() => setSheet({ type: 'detail', recipe: r })}>{r.name}</button>
                  <div class="muted">做过 {count(r)} 次 · {r.baseServings} 人份</div>
                  {missing.length > 0 && <span class="tag miss">缺：{missing.join('、')}</span>}
                </div>
                <Button onClick={() => setSheet({ type: 'want', recipe: r })}>想吃这道</Button>
              </div>
            </PixelBox>
          );
        })}
        {list.length === 0 && <div class="center" style={{ padding: '20px 0' }}><Sprite name="pot" scale={4} /><p class="muted">没有找到这道菜</p></div>}
      </div>
      {sheet?.type === 'new' && <RecipeSheet onClose={() => setSheet(null)} onSaved={done} />}
      {sheet?.type === 'edit' && <RecipeSheet recipe={sheet.recipe} onClose={() => setSheet(null)} onSaved={done} />}
      {sheet?.type === 'detail' && (
        <RecipeDetail recipe={sheet.recipe} onClose={() => setSheet(null)} onDeleted={done}
          onEdit={() => setSheet({ type: 'edit', recipe: sheet.recipe })}
          onWant={() => setSheet({ type: 'want', recipe: sheet.recipe })} />
      )}
      {sheet?.type === 'want' && (
        <RequestSheet initialItems={[sheet.recipe.uid]} onClose={() => setSheet(null)} onSent={done} />
      )}
    </div>
  );
}
