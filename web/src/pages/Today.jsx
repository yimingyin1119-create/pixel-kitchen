import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { Sprite } from '../ui/Sprite.jsx';
import { Toast } from '../ui/Toast.jsx';
import { RequestSheet } from '../ui/RequestSheet.jsx';
import { BRAND, MEALS } from '../copy.js';
import { today, addDays, dateLabel, weekday } from '../lib/time.js';

const MEAL_ORDER = ['lunch', 'dinner', 'late'];

function whenLabel(r) {
  const d = today();
  const day = r.wantedDate === d ? '今天' : r.wantedDate === addDays(d, 1) ? '明天' : dateLabel(r.wantedDate);
  return `${day} ${MEALS[r.meal]}${r.wantedTime ? ` ${r.wantedTime}` : ''}`;
}

function setRequest(view, uid, patch) {
  return { ...view, requests: view.requests.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) };
}

function RequestCard({ r, kind }) {
  const { view, me, act, refresh, highlight } = useApp();
  const [run, pending, error] = useAction();
  const nameOf = (uid) => (uid === me.uid ? '我' : view.users.find((u) => u.uid === uid)?.name ?? '有人');

  const go = (action, patch) => run(async () => {
    try {
      await act(action, { uid: r.uid }, { optimistic: (v) => setRequest(v, r.uid, patch) });
    } catch (err) {
      if (err.code === 'CONFLICT') refresh();
      throw err;
    }
  });

  const mineAsked = r.userUid === me.uid;
  return (
    <PixelBox class={`order-card ${highlight === r.uid ? 'flash' : ''}`}>
      <div class="muted">{whenLabel(r)} · {r.servings} 人 · {nameOf(r.userUid)}提的</div>
      <div class="dish-name">{r.items.map((i) => i.name).join('、')}</div>
      {r.note && <div class="muted">备注：{r.note}</div>}
      {kind === 'others' && <div class="muted">{nameOf(r.takerUid)} 在做</div>}
      {r.shortages?.length > 0 && (
        <a class="tag miss" href="#/shopping">缺：{r.shortages.map((s) => s.name).join('、')}</a>
      )}
      <div class="actions">
        {kind === 'mine' && <>
          <Button variant="secondary" disabled={pending} onClick={() => go('requests.release', { status: 'open', takerUid: '' })}>做不了</Button>
          <Button variant="green" disabled={pending} onClick={() => go('requests.done', { status: 'done' })}>做好了</Button>
        </>}
        {kind !== 'mine' && mineAsked && (
          <Button variant="secondary" disabled={pending} onClick={() => go('requests.cancel', { status: 'cancelled' })}>取消</Button>
        )}
        {kind === 'waiting' && !mineAsked && (
          <Button disabled={pending} onClick={() => go('requests.take', { status: 'taken', takerUid: me.uid })}>接下</Button>
        )}
        {kind === 'waiting' && mineAsked && (
          <Button disabled={pending} onClick={() => go('requests.take', { status: 'taken', takerUid: me.uid })}>我来做</Button>
        )}
      </div>
      {error && <p class="error" role="alert">{error}</p>}
    </PixelBox>
  );
}

function Section({ id, title, list, kind }) {
  if (list.length === 0) return null;
  return (
    <section data-testid={`section-${id}`}>
      <div class="section-title">{title}</div>
      {list.map((r) => <RequestCard key={r.uid} r={r} kind={kind} />)}
    </section>
  );
}

function Reminders() {
  const { view } = useApp();
  const d = today();
  const soon = addDays(d, 3);
  const expiring = view.inventory.filter((i) => i.expiresOn && i.expiresOn <= soon);
  const low = view.inventory.filter((i) => (i.kind === 'seasoning' ? i.status !== 'ok' : i.lowThreshold > 0 && i.qty <= i.lowThreshold));
  if (expiring.length + low.length === 0) return null;
  return (
    <section>
      <div class="section-title">提醒</div>
      <PixelBox class="order-card">
        {expiring.map((i) => <div key={`e${i.uid}`}><span class="tag miss">快过期</span> {i.name}（{dateLabel(i.expiresOn)}）</div>)}
        {low.map((i) => <div key={`l${i.uid}`}><span class="tag miss">快用完</span> {i.name}</div>)}
      </PixelBox>
    </section>
  );
}

export function Today() {
  const { view, me } = useApp();
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState('');
  const d = today();

  const live = view.requests
    .filter((r) => r.status === 'open' || r.status === 'taken')
    .sort((a, b) => a.wantedDate.localeCompare(b.wantedDate) || MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal));
  const mine = live.filter((r) => r.status === 'taken' && r.takerUid === me.uid);
  const waiting = live.filter((r) => r.status === 'open');
  const others = live.filter((r) => r.status === 'taken' && r.takerUid !== me.uid);

  return (
    <div>
      <Header title={BRAND} subtitle={`今天 · ${dateLabel(d)} ${weekday(d)}`} />
      <Toast text={toast} onDone={() => setToast('')} />
      <div class="page">
        <Button class="big-btn" onClick={() => setSheet(true)}>＋ 提个要求</Button>
        <Section id="mine" title="我接的" list={mine} kind="mine" />
        <Section id="waiting" title="等人接" list={waiting} kind="waiting" />
        <Section id="others" title="别人在做" list={others} kind="others" />
        {live.length === 0 && (
          <div class="center" style={{ padding: '24px 0' }}>
            <Sprite name="cat" scale={5} />
            <p class="muted">还没有人提要求，点上面的按钮提一个</p>
          </div>
        )}
        <Reminders />
      </div>
      {sheet && <RequestSheet onClose={() => setSheet(false)} onSent={(msg) => { setSheet(false); setToast(msg); }} />}
    </div>
  );
}
