import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { sameName } from '../../../core/names.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { Toast } from '../ui/Toast.jsx';
import { today } from '../lib/time.js';
import { daysUntil } from '../../../core/time.js';

const STATUS = { ok: '有', low: '快没了', out: '没了' };
const NEXT = { ok: 'low', low: 'out', out: 'ok' };

function formOf(item) {
  return {
    uid: item?.uid, name: item?.name ?? '', kind: item?.kind ?? 'main', qty: item ? String(item.qty) : '',
    unit: item?.unit ?? '', low: item?.lowThreshold ? String(item.lowThreshold) : '', expiresOn: item?.expiresOn ?? '',
  };
}

function StockSheet({ item, onClose, onDone }) {
  const { view, act } = useApp();
  const [form, setForm] = useState(() => formOf(item));
  const [confirming, setConfirming] = useState(false);
  const [run, pending, error, setError] = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.currentTarget.value });

  const save = () => run(async () => {
    const payload = {
      ...(form.uid ? { uid: form.uid } : {}), name: form.name.trim(), kind: form.kind,
      qty: Number(form.qty) || 0, unit: form.unit.trim(), lowThreshold: Number(form.low) || 0, expiresOn: form.expiresOn,
    };
    const before = new Set(view.inventory.map((i) => i.uid));
    try {
      const data = await act('inventory.save', { item: payload }, {
        highlight: (v) => payload.uid ?? v.inventory.find((i) => !before.has(i.uid))?.uid,
      });
      if (data) onDone(`${payload.name} 存好了`);
    } catch (err) {
      const existing = err.code === 'CONFLICT' && view.inventory.find((i) => !i.hidden && sameName(i.name, payload.name));
      if (!existing) throw err;
      setForm(formOf(existing));
      setError(err.message);
    }
  });

  const remove = () => run(async () => {
    const data = await act('inventory.remove', { uid: form.uid }, {
      optimistic: (v) => ({ ...v, inventory: v.inventory.filter((i) => i.uid !== form.uid) }),
    });
    if (data) onDone(`${form.name} 删掉了`);
  });

  return (
    <Sheet title={form.uid ? `改「${form.name}」` : '加一样食材'} onClose={onClose}>
      <label class="field">食材名<input class="px-input" value={form.name} onInput={set('name')} /></label>
      <div class="choice-row">
        <Button variant={form.kind === 'main' ? '' : 'secondary'} onClick={() => setForm({ ...form, kind: 'main' })}>主料</Button>
        <Button variant={form.kind === 'seasoning' ? '' : 'secondary'} onClick={() => setForm({ ...form, kind: 'seasoning' })}>调料</Button>
      </div>
      <label class="field">数量<input class="px-input" inputMode="decimal" value={form.qty} onInput={set('qty')} /></label>
      <label class="field">单位<input class="px-input" placeholder="g、个、把……" value={form.unit} onInput={set('unit')} /></label>
      <label class="field">少于多少提醒<input class="px-input" inputMode="decimal" value={form.low} onInput={set('low')} /></label>
      <label class="field">保质期（可不填）<input class="px-input" type="date" value={form.expiresOn} onInput={set('expiresOn')} /></label>
      {error && <p class="error" role="alert">{error}</p>}
      {confirming ? (
        <PixelBox class="page">
          <p>确定删除「{form.name}」？</p>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirming(false)}>先不删</Button>
            <Button disabled={pending} onClick={remove}>确定删除</Button>
          </div>
        </PixelBox>
      ) : (
        <div class="row" style={{ justifyContent: form.uid ? 'space-between' : 'flex-end', marginTop: '10px' }}>
          {form.uid && <Button variant="secondary" onClick={() => setConfirming(true)}>删除</Button>}
          <Button disabled={pending} onClick={save}>{pending ? '保存中…' : '保存'}</Button>
        </div>
      )}
    </Sheet>
  );
}

function StockRow({ item, onOpen }) {
  const { act, highlight } = useApp();
  const [run, pending, error] = useAction();
  const days = item.expiresOn ? daysUntil(item.expiresOn, today()) : null;
  const low = item.kind === 'main' && item.lowThreshold > 0 && item.qty <= item.lowThreshold;
  const fill = Math.min(1, item.qty / Math.max(item.lowThreshold * 3, 1));
  const cycle = () => run(() => act('inventory.save', { item: { uid: item.uid, status: NEXT[item.status] } }, {
    optimistic: (v) => ({ ...v, inventory: v.inventory.map((i) => (i.uid === item.uid ? { ...i, status: NEXT[item.status] } : i)) }),
  }));
  return (
    <PixelBox class={`order-card ${highlight === item.uid ? 'flash' : ''}`} data-testid={`stock-${item.uid}`}>
      <div class="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" class="name-btn" data-testid="stock-name" onClick={() => onOpen(item)}>{item.name}</button>
        {item.kind === 'seasoning' ? (
          <Button variant="secondary" disabled={pending} aria-label={`${item.name}：${STATUS[item.status]}`} onClick={cycle}>{STATUS[item.status]}</Button>
        ) : (
          <span class="muted">{item.qty} {item.unit}</span>
        )}
      </div>
      {item.kind === 'main' && <div class="bar"><i style={{ width: `${fill * 100}%`, background: low ? 'var(--tomato)' : 'var(--leaf)' }} /></div>}
      {low && <span class="tag miss">快用完了</span>}
      {days !== null && days <= 3 && <span class="tag miss">{days < 0 ? '已过期' : `还剩 ${days} 天`}</span>}
      {error && <p class="error" role="alert">{error}</p>}
    </PixelBox>
  );
}

export function Stock() {
  const { view } = useApp();
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const items = view.inventory.filter((i) => !i.hidden).sort((a, b) => (b.stockedIso ?? '').localeCompare(a.stockedIso ?? ''));
  const mains = items.filter((i) => i.kind === 'main').length;
  const done = (msg) => { setSheet(null); setToast(msg); };

  return (
    <div>
      <Header title="食材库" subtitle={`主料 ${mains} · 调料 ${items.length - mains}`} />
      <Toast text={toast} onDone={() => setToast('')} />
      <div class="page">
        <Button class="big-btn" onClick={() => setSheet({ item: null })}>＋ 加食材</Button>
        {items.length === 0 && <p class="muted center">食材库还是空的。买菜时在「采购」里打勾，会自动进来。</p>}
        {items.map((i) => <StockRow key={i.uid} item={i} onOpen={(item) => setSheet({ item })} />)}
      </div>
      {sheet && <StockSheet item={sheet.item} onClose={() => setSheet(null)} onDone={done} />}
    </div>
  );
}
