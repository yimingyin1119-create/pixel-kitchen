// M1 stand-ins so the chef can enter dishes and stock by hand; M2/M3 replace them with the full pages.
import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';

const SEASONING_UNITS = ['适量', '少许', '大勺', '小勺', '勺', '汤匙', '茶匙'];

// "五花肉 500 g" → { name, qty, unit, kind }
export function parseIngredientLine(line) {
  const text = String(line).trim();
  if (!text) return null;
  const [, name, rest = ''] = text.match(/^(\S+)\s*(.*)$/);
  const m = rest.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  const qty = m ? Number(m[1]) : null;
  const unit = (m ? m[2] : rest).trim() || (qty === null ? '适量' : '');
  const kind = qty === null || SEASONING_UNITS.includes(unit) ? 'seasoning' : 'main';
  return { name, qty, unit, kind };
}

function useSubmit() {
  const { act } = useApp();
  const [msg, setMsg] = useState('');
  const run = async (action, payload, ok) => {
    setMsg('');
    try {
      const data = await act(action, payload);
      if (data !== undefined) setMsg(ok);
      return data;
    } catch (err) {
      setMsg(err.message);
      return undefined;
    }
  };
  return [run, msg];
}

export function QuickRecipe() {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('2');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [run, msg] = useSubmit();
  const save = async () => {
    const recipe = {
      name: name.trim(), baseServings: Number(servings) || 2, zone: 'signature',
      ingredients: ingredients.split('\n').map(parseIngredientLine).filter(Boolean),
      steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    if (await run('recipes.save', { recipe }, `「${recipe.name}」存好了`)) {
      setName(''); setIngredients(''); setSteps('');
    }
  };
  return (
    <PixelBox class="page">
      <div>手动录一道拿手菜</div>
      <label class="field">菜名<input class="px-input" value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
      <label class="field">几人份<input class="px-input" inputMode="numeric" value={servings} onInput={(e) => setServings(e.currentTarget.value)} /></label>
      <label class="field">食材（一行一样）
        <textarea class="px-input" placeholder={'五花肉 500 g\n生抽 1 大勺\n盐 适量'} value={ingredients} onInput={(e) => setIngredients(e.currentTarget.value)} />
      </label>
      <label class="field">步骤（一行一步）
        <textarea class="px-input" value={steps} onInput={(e) => setSteps(e.currentTarget.value)} />
      </label>
      <Button onClick={save}>存进拿手菜</Button>
      {msg && <p class="muted" role="status">{msg}</p>}
    </PixelBox>
  );
}

export function QuickStock() {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('main');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [low, setLow] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [run, msg] = useSubmit();
  const save = async () => {
    const item = { name: name.trim(), kind, qty: Number(qty) || 0, unit: unit.trim(), lowThreshold: Number(low) || 0, expiresOn };
    if (await run('inventory.save', { item }, `「${item.name}」入库了`)) {
      setName(''); setQty(''); setUnit(''); setLow(''); setExpiresOn('');
    }
  };
  return (
    <PixelBox class="page">
      <div>加一样食材</div>
      <label class="field">食材名<input class="px-input" value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
      <div class="choice-row">
        <Button variant={kind === 'main' ? '' : 'secondary'} onClick={() => setKind('main')}>主料</Button>
        <Button variant={kind === 'seasoning' ? '' : 'secondary'} onClick={() => setKind('seasoning')}>调料</Button>
      </div>
      <label class="field">数量<input class="px-input" inputMode="decimal" value={qty} onInput={(e) => setQty(e.currentTarget.value)} /></label>
      <label class="field">单位<input class="px-input" placeholder="g、个、ml……" value={unit} onInput={(e) => setUnit(e.currentTarget.value)} /></label>
      <label class="field">少于多少提醒<input class="px-input" inputMode="decimal" value={low} onInput={(e) => setLow(e.currentTarget.value)} /></label>
      <label class="field">保质期（可不填）<input class="px-input" type="date" value={expiresOn} onInput={(e) => setExpiresOn(e.currentTarget.value)} /></label>
      <Button onClick={save}>加进食材库</Button>
      {msg && <p class="muted" role="status">{msg}</p>}
    </PixelBox>
  );
}

export function RecipesM1() {
  const { view, me } = useApp();
  const live = view.recipes.filter((r) => !r.archived);
  return (
    <div>
      <Header subtitle="菜谱" />
      <div class="page">
        <div class="section-title">拿手菜</div>
        <p>{live.filter((r) => r.zone === 'signature').map((r) => r.name).join('、') || '还没有'}</p>
        <div class="section-title">想吃清单</div>
        <p>{live.filter((r) => r.zone === 'wish').map((r) => r.name).join('、') || '还没有'}</p>
        {me.role === 'chef' && <QuickRecipe />}
        <p class="muted">贴链接、拍照导入菜谱会在下一版加上。</p>
      </div>
    </div>
  );
}

export function InventoryM1() {
  const { view } = useApp();
  return (
    <div>
      <Header subtitle="食材库" />
      <div class="page">
        {view.inventory.length === 0 && <p class="muted">食材库还是空的</p>}
        {view.inventory.map((i) => (
          <div key={i.uid} class="row" style={{ justifyContent: 'space-between', margin: '4px' }}>
            <span>{i.name}</span>
            <span class="muted">{i.kind === 'seasoning' ? { ok: '有', low: '快没了', out: '没了' }[i.status] : `${i.qty} ${i.unit}`}</span>
          </div>
        ))}
        <QuickStock />
      </div>
    </div>
  );
}
