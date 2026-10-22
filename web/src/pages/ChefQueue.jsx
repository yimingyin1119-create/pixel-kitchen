import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { MEALS } from '../copy.js';
import { dateLabel } from '../lib/time.js';

const MEAL_ORDER = ['lunch', 'dinner', 'late'];
const REASONS = ['缺料', '今天没空'];

function RejectSheet({ onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const confirm = () => {
    if (!reason.trim()) { setError('写一下为什么做不了'); return; }
    onConfirm(reason.trim());
  };
  return (
    <Sheet title="这单做不了" onClose={onClose}>
      <div class="choice-row">
        {REASONS.map((r) => <Button key={r} variant={reason === r ? '' : 'secondary'} onClick={() => setReason(r)}>{r}</Button>)}
      </div>
      <label class="field">或者自己写
        <textarea class="px-input" value={reason} onInput={(e) => setReason(e.currentTarget.value)} />
      </label>
      {error && <p class="error" role="alert">{error}</p>}
      <div class="row" style={{ justifyContent: 'flex-end' }}><Button onClick={confirm}>确定拒单</Button></div>
    </Sheet>
  );
}

// Open orders grouped by day and meal so the chef sees what to cook for which sitting.
export function ChefQueue() {
  const { view, act } = useApp();
  const [rejecting, setRejecting] = useState(null);
  const open = view.orders.filter((o) => o.status === 'pending' || o.status === 'accepted');
  const nameOf = (uid) => view.users.find((u) => u.uid === uid)?.name ?? '有人';

  const groups = new Map();
  for (const o of [...open].sort((a, b) => a.wantedDate.localeCompare(b.wantedDate) || MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal))) {
    const key = `${o.wantedDate}|${o.meal}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }

  return (
    <div>
      <div class="section-title">待处理订单</div>
      {open.length === 0 && <p class="muted">现在没有待处理的订单</p>}
      {[...groups.entries()].map(([key, orders]) => {
        const [date, meal] = key.split('|');
        return (
          <div key={key}>
            <div class="muted" data-testid="meal-group">{`${dateLabel(date)} ${MEALS[meal]} · ${orders.length} 单`}</div>
            {orders.map((o) => (
              <PixelBox key={o.uid} class="order-card">
                <div>{nameOf(o.userUid)} 点了 {o.items.map((i) => i.name).join('、')}</div>
                <div class="muted">{o.servings} 人{o.wantedTime ? ` · ${o.wantedTime}` : ''}{o.status === 'accepted' ? ' · 已接单' : ''}</div>
                {o.note && <div class="muted">备注：{o.note}</div>}
                {o.shortages?.length > 0 && <span class="tag miss">缺：{o.shortages.map((s) => s.name).join('、')}</span>}
                <div class="actions">
                  <Button variant="secondary" onClick={() => setRejecting(o.uid)}>拒单</Button>
                  {o.status === 'pending'
                    ? <Button onClick={() => act('orders.accept', { uid: o.uid })}>接单</Button>
                    : <Button variant="green" onClick={() => act('orders.done', { uid: o.uid })}>做好了</Button>}
                </div>
              </PixelBox>
            ))}
          </div>
        );
      })}
      {rejecting && (
        <RejectSheet
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => { await act('orders.reject', { uid: rejecting, reason }); setRejecting(null); }}
        />
      )}
    </div>
  );
}
