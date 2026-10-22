import { useState } from 'preact/hooks';
import { Sheet } from './Sheet.jsx';
import { Button } from './PixelBox.jsx';
import { MEALS } from '../copy.js';
import { today, hourNow, addDays, dateLabel } from '../lib/time.js';

export function defaultMeal(hour) {
  if (hour < 14) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'late';
}

// Collects servings, date, meal, optional time and note; onSubmit may throw an ApiError.
export function Checkout({ count, onSubmit, onClose }) {
  const start = today();
  const [servings, setServings] = useState(2);
  const [date, setDate] = useState(start);
  const [meal, setMeal] = useState(() => defaultMeal(hourNow()));
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const quickDates = [['今天', start], ['明天', addDays(start, 1)], ['后天', addDays(start, 2)]];

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit({ servings, wantedDate: date, meal, wantedTime: time, note: note.trim() });
    } catch (err) {
      setError(err.message || '下单没成功，再试一次');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`下单 · ${count} 道菜`} onClose={onClose}>
      <div class="field">几个人吃</div>
      <div class="row">
        <Button variant="secondary" aria-label="减一人" onClick={() => setServings(Math.max(1, servings - 1))}>−</Button>
        <span style={{ minWidth: '48px', textAlign: 'center' }}>{servings} 人</span>
        <Button variant="secondary" aria-label="加一人" onClick={() => setServings(Math.min(20, servings + 1))}>+</Button>
      </div>

      <div class="field">哪天吃 · {dateLabel(date)}</div>
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

      {error && <p class="error" role="alert">{error}</p>}
      <div class="row" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
        <Button disabled={busy} onClick={submit}>下单</Button>
      </div>
    </Sheet>
  );
}
