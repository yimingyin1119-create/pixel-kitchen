import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { Sheet } from './Sheet.jsx';
import { Button } from './PixelBox.jsx';
import { MEALS } from '../copy.js';
import { today, hourNow, addDays, dateLabel } from '../lib/time.js';

export function defaultMeal(hour) {
  if (hour < 14) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'late';
}

// Pick dishes, how many people, when, and whether you cook it yourself.
export function RequestSheet({ initialItems = [], onClose, onSent }) {
  const { view, act } = useApp();
  const start = today();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [servings, setServings] = useState(2);
  const [date, setDate] = useState(start);
  const [meal, setMeal] = useState(() => defaultMeal(hourNow()));
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [selfCook, setSelfCook] = useState(false);
  const [run, pending, error, setError] = useAction();

  const dishes = view.recipes.filter((r) => !r.archived && r.name.includes(search.trim()));
  const toggle = (uid) => setItems(items.includes(uid) ? items.filter((u) => u !== uid) : [...items, uid]);
  const quickDates = [['今天', start], ['明天', addDays(start, 1)], ['后天', addDays(start, 2)]];

  const submit = () => run(async () => {
    if (items.length === 0) { setError('至少选一道菜'); return; }
    const before = new Set(view.requests.map((r) => r.uid));
    const data = await act('requests.create',
      { items, servings, wantedDate: date, meal, wantedTime: time, note: note.trim(), selfCook },
      { highlight: (v) => v.requests.find((r) => !before.has(r.uid))?.uid });
    if (data) onSent?.(selfCook ? '记下了，你来做' : '已经发出去了');
  });

  return (
    <Sheet title="提个要求" onClose={onClose}>
      <input class="px-input" placeholder="搜菜名" value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
      <div class="dish-picker">
        {dishes.map((r) => {
          const missing = view.availability[r.uid]?.missing ?? [];
          return (
            <label key={r.uid} class="pick-row">
              <input type="checkbox" checked={items.includes(r.uid)} onChange={() => toggle(r.uid)} />
              <span>{r.name}</span>
              {missing.length > 0 && <span class="tag miss">缺：{missing.join('、')}</span>}
            </label>
          );
        })}
        {dishes.length === 0 && <p class="muted">没有找到，去「菜谱」里加一道</p>}
      </div>

      <div class="field">几个人吃</div>
      <div class="row">
        <Button variant="secondary" aria-label="减一人" onClick={() => setServings(Math.max(1, servings - 1))}>−</Button>
        <span style={{ minWidth: '48px', textAlign: 'center' }}>{servings} 人</span>
        <Button variant="secondary" aria-label="加一人" onClick={() => setServings(Math.min(20, servings + 1))}>+</Button>
      </div>

      <div class="field">哪天 · {dateLabel(date)}</div>
      <div class="choice-row">
        {quickDates.map(([label, d]) => (
          <Button key={label} variant={date === d ? '' : 'secondary'} aria-pressed={date === d} onClick={() => setDate(d)}>{label}</Button>
        ))}
        <input class="px-input" type="date" aria-label="选日期" min={start} value={date} style={{ width: 'auto' }}
          onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)} />
      </div>

      <div class="field">哪一顿</div>
      <div class="choice-row">
        {Object.entries(MEALS).map(([key, label]) => (
          <Button key={key} variant={meal === key ? '' : 'secondary'} aria-pressed={meal === key} onClick={() => setMeal(key)}>{label}</Button>
        ))}
      </div>

      <label class="field">具体时间（可不填）
        <input class="px-input" type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} />
      </label>
      <label class="field">备注
        <textarea class="px-input" maxLength={200} placeholder="少辣、不要香菜……" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      </label>
      <label class="pick-row">
        <input type="checkbox" checked={selfCook} onChange={() => setSelfCook(!selfCook)} />
        <span>我自己来做</span>
      </label>

      {error && <p class="error" role="alert">{error}</p>}
      <div class="row" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
        <Button disabled={pending} onClick={submit}>{pending ? '发送中…' : '提交'}</Button>
      </div>
    </Sheet>
  );
}
