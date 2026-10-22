import { useState } from 'preact/hooks';
import { call, ApiError } from '../api.js';
import { Header } from '../ui/Header.jsx';
import { PinPad } from '../ui/PinPad.jsx';
import { Sprite } from '../ui/Sprite.jsx';
import { BRAND, SLOGAN } from '../copy.js';

// Name + 4-digit pin; "第一次来？注册" switches to creating an account.
export function Login({ onSignedIn }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  const submit = async (pin) => {
    if (!name.trim()) { setError('先写上名字'); return; }
    setBusy(true);
    setError('');
    try {
      const data = await call(register ? 'auth.register' : 'auth.login', { name: name.trim(), pin });
      onSignedIn(data.token, data.view);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '连不上服务器，稍后再试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Header title={BRAND} subtitle={SLOGAN} />
      <div class="page center">
        <div class="row" style={{ justifyContent: 'center', margin: '16px 0 8px' }}><Sprite name="hat" scale={5} /></div>
        <h2 style={{ fontWeight: 'normal', margin: '4px 0' }}>{register ? `加入${BRAND}` : '欢迎回来'}</h2>
        <input class="px-input" placeholder="你的名字" value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={20} />
        <p class="muted">{register ? '设一个 4 位数字口令，以后用它登录' : '输入 4 位口令'}</p>
        <PinPad onSubmit={submit} disabled={busy} />
        {error && <p class="error" role="alert">{error}</p>}
        <button type="button" class="link-btn" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); }}>
          {register ? '已有账号？登录' : '第一次来？注册'}
        </button>
      </div>
    </div>
  );
}
