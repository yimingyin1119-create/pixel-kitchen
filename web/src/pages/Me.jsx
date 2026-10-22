import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';

function PushSetup() {
  const { me, act } = useApp();
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [saveRun, saving, saveError] = useAction();
  const [testRun, testing, testError] = useAction();
  const save = () => saveRun(async () => {
    if (await act('me.update', { pushToken: token.trim() })) setMsg('保存好了，点「发一条试试」看看');
  });
  const tryIt = () => testRun(async () => {
    if (await act('me.testPush', {})) setMsg('发出去了，看看微信');
  });
  return (
    <PixelBox class="page">
      <div>微信推送 · {me.hasPush ? '已设置' : '还没设置'}</div>
      <ol class="muted" style={{ paddingLeft: '18px' }}>
        <li>微信搜索并关注公众号「pushplus 推送加」</li>
        <li>在公众号菜单里找到「功能 → 个人中心 → 一对一推送」，复制你的 token</li>
        <li>粘贴到下面，点保存，再点「发一条试试」</li>
      </ol>
      <label class="field">PushPlus token
        <input class="px-input" value={token} onInput={(e) => setToken(e.currentTarget.value)} placeholder="一串字母和数字" />
      </label>
      <div class="row">
        <Button disabled={saving} onClick={save}>{saving ? '保存中…' : '保存 token'}</Button>
        <Button variant="secondary" disabled={testing} onClick={tryIt}>{testing ? '发送中…' : '发一条试试'}</Button>
      </div>
      {(saveError || testError || msg) && <p class="muted" role="status">{saveError || testError || msg}</p>}
    </PixelBox>
  );
}

function Members() {
  const { view, act } = useApp();
  const [who, setWho] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [run, pending, error] = useAction();
  const reset = () => run(async () => {
    if (await act('users.resetPin', { uid: who, pin })) {
      setMsg(`已经把 ${view.users.find((u) => u.uid === who)?.name ?? ''} 的口令改成新的了`);
      setPin('');
    }
  });
  return (
    <PixelBox class="page">
      <div>一起搭伙的人</div>
      <p class="muted">{view.users.map((u) => u.name).join('、')}</p>
      <div class="muted">有人忘了口令？帮 TA 设一个新的：</div>
      <label class="field">帮谁重置
        <select class="px-input" value={who} onChange={(e) => setWho(e.currentTarget.value)}>
          <option value="">选一个人</option>
          {view.users.map((u) => <option key={u.uid} value={u.uid}>{u.name}</option>)}
        </select>
      </label>
      <label class="field">新口令
        <input class="px-input" inputMode="numeric" maxLength={4} value={pin} onInput={(e) => setPin(e.currentTarget.value)} />
      </label>
      <Button variant="secondary" disabled={pending || !who || pin.length !== 4} onClick={reset}>重置口令</Button>
      {(error || msg) && <p class="muted" role="status">{error || msg}</p>}
    </PixelBox>
  );
}

export function Me() {
  const { me, signOut } = useApp();
  return (
    <div>
      <Header title="我的" subtitle={me.name} />
      <div class="page">
        <PushSetup />
        <Members />
        <Button variant="secondary" onClick={signOut}>退出登录</Button>
      </div>
    </div>
  );
}
