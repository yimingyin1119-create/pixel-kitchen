import { useState } from 'preact/hooks';
import { call, ApiError } from '../api.js';
import { Header } from '../ui/Header.jsx';
import { PinPad } from '../ui/PinPad.jsx';
import { Sprite } from '../ui/Sprite.jsx';

function messageOf(err) {
  return err instanceof ApiError ? err.message : '连不上服务器，稍后再试';
}

// Name + 4-digit pin. With mode="setup" it creates the first (chef) account instead.
export function Login({ mode = 'login', onSignedIn, onNoUsers }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const setup = mode === 'setup';

  const submit = async (pin) => {
    if (!name.trim()) { setError('先写上名字'); return; }
    setBusy(true);
    setError('');
    try {
      const data = await call(setup ? 'auth.setup' : 'auth.login', { name: name.trim(), pin });
      onSignedIn(data.token, data.view);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NO_USERS') onNoUsers?.();
      else setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Header subtitle={setup ? '第一次使用' : '慢炖生活 · 暖心料理'} />
      <div class="page center">
        <div class="row" style={{ justifyContent: 'center', margin: '16px 0 8px' }}><Sprite name="hat" scale={5} /></div>
        <h2 style={{ fontWeight: 'normal', margin: '4px 0' }}>{setup ? '建一个厨师账号' : '欢迎回来'}</h2>
        {setup && <p class="muted">这是第一个账号，会成为厨师。其他人之后由厨师添加。</p>}
        <input class="px-input" placeholder="你的名字" value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={20} />
        <p class="muted">{setup ? '设一个 4 位数字口令' : '输入 4 位口令'}</p>
        <PinPad onSubmit={submit} disabled={busy} />
        {error && <p class="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
