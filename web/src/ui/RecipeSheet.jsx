import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { parseIngredientLine, formatIngredientLine } from '../lib/ingredients.js';
import { sameName } from '../../../core/names.js';
import { Sheet } from './Sheet.jsx';
import { Button } from './PixelBox.jsx';

function formOf(recipe) {
  return {
    uid: recipe?.uid,
    name: recipe?.name ?? '',
    servings: String(recipe?.baseServings ?? 2),
    ingredients: (recipe?.ingredients ?? []).map(formatIngredientLine).join('\n'),
    steps: (recipe?.steps ?? []).join('\n'),
  };
}

// New or edit. A name that already exists switches the form to that dish instead of making a twin.
export function RecipeSheet({ recipe, onClose, onSaved }) {
  const { view, act } = useApp();
  const [form, setForm] = useState(() => formOf(recipe));
  const [run, pending, error, setError] = useAction();
  const set = (key) => (e) => setForm({ ...form, [key]: e.currentTarget.value });

  const save = () => run(async () => {
    const payload = {
      ...(form.uid ? { uid: form.uid } : {}),
      name: form.name.trim(),
      baseServings: Number(form.servings) || 2,
      ingredients: form.ingredients.split('\n').map(parseIngredientLine).filter(Boolean),
      steps: form.steps.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    const before = new Set(view.recipes.map((r) => r.uid));
    try {
      const data = await act('recipes.save', { recipe: payload }, {
        highlight: (v) => payload.uid ?? v.recipes.find((r) => !before.has(r.uid))?.uid,
      });
      if (data) onSaved?.(`「${payload.name}」存好了`);
    } catch (err) {
      const existing = err.code === 'CONFLICT' && view.recipes.find((r) => !r.archived && sameName(r.name, payload.name));
      if (!existing) throw err;
      setForm(formOf(existing));
      setError(`${err.message}，可以在这里改`);
    }
  });

  return (
    <Sheet title={form.uid ? `改「${form.name}」` : '新菜谱'} onClose={onClose}>
      <label class="field">菜名<input class="px-input" value={form.name} onInput={set('name')} /></label>
      <label class="field">几人份<input class="px-input" inputMode="numeric" value={form.servings} onInput={set('servings')} /></label>
      <label class="field">食材（一行一样）
        <textarea class="px-input" rows={5} placeholder={'五花肉 500 g\n生抽 1 大勺\n盐 适量'} value={form.ingredients} onInput={set('ingredients')} />
      </label>
      <label class="field">步骤（一行一步）
        <textarea class="px-input" rows={4} value={form.steps} onInput={set('steps')} />
      </label>
      {error && <p class="error" role="alert">{error}</p>}
      <div class="row" style={{ justifyContent: 'flex-end' }}>
        <Button disabled={pending} onClick={save}>{pending ? '保存中…' : '保存'}</Button>
      </div>
    </Sheet>
  );
}
