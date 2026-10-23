import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { Toast } from '../ui/Toast.jsx';
import { Sprite } from '../ui/Sprite.jsx';
import { MEALS } from '../copy.js';
import { today, addDays, dateLabel } from '../lib/time.js';

function dayLabel(date) {
  const d = today();
  if (date === d) return '今天';
  if (date === addDays(d, 1)) return '明天';
  return dateLabel(date);
}

// Why this item is on the list: which dish and when, low stock, or added by hand.
export function annotations(item) {
  const lines = new Set();
  for (const r of item.reasons ?? []) {
    if (r.type === 'order' && r.dishes) lines.add(`${r.dishes.join('、')} · ${dayLabel(r.wantedDate)}${MEALS[r.meal] ?? ''}`);
    else if (r.type === 'low') lines.add('快用完了');
    else if (r.type === 'manual') lines.add('手动加的');
  }
  return [...lines];
}

const markDone = (uid, done) => (v) => ({ ...v, shopping: v.shopping.map((s) => (s.uid === uid ? { ...s, done } : s)) });

function CheckSheet({ item, onClose, onDone }) {
  const { act } = useApp();
  const [qty, setQty] = useState(item.qty > 0 ? String(item.qty) : '');
  const [unit, setUnit] = useState(item.unit);
  const [expiresOn, setExpiresOn] = useState('');
  const [run, pending, error] = useAction();
  const save = () => run(async () => {
    const payload = { uid: item.uid, boughtQty: Number(qty), unit: unit.trim(), ...(expiresOn ? { expiresOn } : {}) };
    const data = await act('shopping.check', payload, { optimistic: markDone(item.uid, true), highlight: item.inventoryUid || undefined });
    if (data) onDone(`${item.name} 入库了`);
  });
  return (
    <Sheet title={`买到了：${item.name}`} onClose={onClose}>
      <label class="field">买了多少<input class="px-input" inputMode="decimal" value={qty} onInput={(e) => setQty(e.currentTarget.value)} /></label>
      <label class="field">单位<input class="px-input" placeholder="g、个、把……" value={unit} onInput={(e) => setUnit(e.currentTarget.value)} /></label>
      <label class="field">保质期到（可不填）<input class="px-input" type="date" value={expiresOn} onInput={(e) => setExpiresOn(e.currentTarget.value)} /></label>
      {error && <p class="error" role="alert">{error}</p>}
      <Button class="big-btn green" variant="green" disabled={pending || !(Number(qty) > 0)} onClick={save}>存进食材库</Button>
    </Sheet>
  );
}

function AddSheet({ onClose, onDone }) {
  const { act } = useApp();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [run, pending, error] = useAction();
  const save = () => run(async () => {
    const data = await act('shopping.add', { name: name.trim(), qty: Number(qty), unit: unit.trim() });
    if (data) onDone(`${name.trim()} 加进清单了`);
  });
  return (
    <Sheet title="手动加一样" onClose={onClose}>
      <label class="field">买什么<input class="px-input" value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
      <label class="field">数量<input class="px-input" inputMode="decimal" value={qty} onInput={(e) => setQty(e.currentTarget.value)} /></label>
      <label class="field">单位<input class="px-input" value={unit} onInput={(e) => setUnit(e.currentTarget.value)} /></label>
      {error && <p class="error" role="alert">{error}</p>}
      <Button class="big-btn" disabled={pending} onClick={save}>加进清单</Button>
    </Sheet>
  );
}

function ToBuyRow({ item, onCheck }) {
  const { act } = useApp();
  const [run, pending, error] = useAction();
  const manualOnly = item.reasons.every((r) => r.type === 'manual');
  const remove = () => run(() => act('shopping.remove', { uid: item.uid }, {
    optimistic: (v) => ({ ...v, shopping: v.shopping.filter((s) => s.uid !== item.uid) }),
  }));
  return (
    <PixelBox class="order-card">
      <div class="row">
        <label class="pick-row" style={{ flex: 1, borderBottom: 0 }}>
          <input type="checkbox" checked={false} onChange={() => onCheck(item)} />
          <span>{item.name}{item.qty > 0 ? ` ${item.qty} ${item.unit}` : ''}</span>
        </label>
        {manualOnly && <Button variant="secondary" disabled={pending} onClick={remove}>删</Button>}
      </div>
      {annotations(item).map((a) => <div key={a} class="muted" style={{ paddingLeft: '30px' }}>{a}</div>)}
      {error && <p class="error" role="alert">{error}</p>}
    </PixelBox>
  );
}

function BoughtRow({ item }) {
  const { act } = useApp();
  const [run, pending, error] = useAction();
  const undo = () => run(() => act('shopping.uncheck', { uid: item.uid }, { optimistic: markDone(item.uid, false) }));
  return (
    <div class="row" style={{ justifyContent: 'space-between', margin: '6px 4px', opacity: 0.7 }}>
      <span><s>{item.name}</s> <span class="muted">买了 {item.boughtQty} {item.unit}</span></span>
      <Button variant="secondary" disabled={pending} onClick={undo}>撤销</Button>
      {error && <p class="error" role="alert">{error}</p>}
    </div>
  );
}

export function Shopping() {
  const { view } = useApp();
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const toBuy = view.shopping.filter((s) => !s.done && !s.removed);
  const bought = view.shopping.filter((s) => s.done && !s.removed);
  const done = (msg) => { setSheet(null); setToast(msg); };

  return (
    <div>
      <Header title="采购清单" subtitle={`还要买 ${toBuy.length} 样`} icon="cart" />
      <Toast text={toast} onDone={() => setToast('')} />
      <div class="page">
        <Button class="big-btn icon-btn" onClick={() => setSheet({ type: 'add' })}><Sprite name="cart" scale={2} tint="#fff6e6" />手动加</Button>
        <section data-testid="to-buy">
          <div class="section-title"><Sprite name="cart" scale={2} />要买</div>
          {toBuy.length === 0 && <div class="center" style={{ padding: '16px 0' }}><Sprite name="basket" scale={4} /><p class="muted">都买齐了</p></div>}
          {toBuy.map((s) => <ToBuyRow key={s.uid} item={s} onCheck={(item) => setSheet({ type: 'check', item })} />)}
        </section>
        {bought.length > 0 && (
          <section data-testid="bought">
            <div class="section-title"><Sprite name="basket" scale={2} />已买（点撤销可以退回）</div>
            {bought.map((s) => <BoughtRow key={s.uid} item={s} />)}
          </section>
        )}
      </div>
      {sheet?.type === 'check' && <CheckSheet item={sheet.item} onClose={() => setSheet(null)} onDone={done} />}
      {sheet?.type === 'add' && <AddSheet onClose={() => setSheet(null)} onDone={done} />}
    </div>
  );
}
