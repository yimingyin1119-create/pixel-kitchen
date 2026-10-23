import { useApp } from '../store.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox } from '../ui/PixelBox.jsx';
import { Sprite } from '../ui/Sprite.jsx';
import { MEALS } from '../copy.js';
import { dateLabel, weekday } from '../lib/time.js';
import { cookLine, doneAt, doneRequests } from '../lib/meals.js';
import { dishIcon } from '../lib/dishIcon.js';

// Every finished meal, newest first, grouped by the day it was for.
export function History() {
  const { view } = useApp();
  const meals = doneRequests(view.requests);
  const days = [];
  for (const r of meals) {
    const last = days.at(-1);
    if (last && last.date === r.wantedDate) last.meals.push(r);
    else days.push({ date: r.wantedDate, meals: [r] });
  }
  const iconOf = (r) => dishIcon(view.recipes.find((x) => x.uid === r.items[0]?.recipeUid) ?? { name: r.items[0]?.name ?? '' });

  return (
    <div>
      <Header title="吃饭记录" subtitle={`一共做了 ${meals.length} 顿`} icon="scroll" />
      <div class="page">
        <a class="link-btn" href="#/me">← 回到我的</a>
        {meals.length === 0 && (
          <div class="center" style={{ padding: '24px 0' }}>
            <Sprite name="scroll" scale={5} />
            <p class="muted">还没有做过饭，做好的每一顿都会记在这里</p>
          </div>
        )}
        {days.map((d) => (
          <section key={d.date}>
            <div class="day-title" data-testid="history-day">{dateLabel(d.date)} {weekday(d.date)}</div>
            {d.meals.map((r) => (
              <PixelBox key={r.uid} class="order-card" data-testid="history-meal">
                <div class="row"><Sprite name={iconOf(r)} scale={2} /><span>{MEALS[r.meal]} · {doneAt(r)} 做好</span></div>
                <div class="dish-name">{r.items.map((i) => i.name).join('、')}</div>
                <div class="muted">{cookLine(r, view.users)} · {r.servings} 人</div>
              </PixelBox>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
