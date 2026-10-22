import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';

// Runs an action and turns ApiErrors into a message instead of an exception.
function useAction() {
  const { act } = useApp();
  const [msg, setMsg] = useState('');
  const run = async (action, payload, ok) => {
    setMsg('');
    try {
      const data = await act(action, payload);
      if (data !== undefined && ok) setMsg(ok);
      return data;
    } catch (err) {
      setMsg(err.message);
      return undefined;
    }
  };
  return [run, msg];
}

function PushSetup() {
  const { me } = useApp();
  const [token, setToken] = useState('');
  const [run, msg] = useAction();
  return (
    <PixelBox class="page">
      <div>微信推送 {me.hasPush ? '· 已设置' : '· 还没设置'}</div>
      <ol class="muted" style={{ paddingLeft: '18px' }}>
        <li>微信搜索并关注公众号「pushplus 推送加」</li>
        <li>在公众号菜单里找到「功能 → 个人中心 → 一对一推送」，复制你的 token</li>
        <li>粘贴到下面，点保存，再点「发一条试试」</li>
      </ol>
      <label class="field">PushPlus token
        <input class="px-input" value={token} onInput={(e) => setToken(e.currentTarget.value)} placeholder="一串字母和数字" />
      </label>
      <div class="row">
        <Button onClick={() => run('me.update', { pushToken: token.trim() }, '保存好了')}>保存 token</Button>
        <Button variant="secondary" onClick={() => run('me.testPush', {}, '发出去了，看看微信')}>发一条试试</Button>
      </div>
      {msg && <p class="muted" role="status">{msg}</p>}
    </PixelBox>
  );
}

function Members() {
  const { view } = useApp();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [run, msg] = useAction();
  const add = async () => {
    const data = await run('users.create', { name: name.trim(), pin }, `已添加：${name.trim()}`);
    if (data) { setName(''); setPin(''); }
  };
  return (
    <PixelBox class="page">
      <div>成员</div>
      <p class="muted">{view.users.map((u) => `${u.name}${u.role === 'chef' ? '（厨师）' : ''}`).join('、')}</p>
      <label class="field">成员名字
        <input class="px-input" value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={20} />
      </label>
      <label class="field">4 位口令
        <input class="px-input" inputMode="numeric" maxLength={4} value={pin} onInput={(e) => setPin(e.currentTarget.value)} />
      </label>
      <Button onClick={add}>添加成员</Button>
      {msg && <p class="muted" role="status">{msg}</p>}
    </PixelBox>
  );
}

export function Me() {
  const { me, signOut } = useApp();
  return (
    <div>
      <Header subtitle="我的" />
      <div class="page">
        <PixelBox class="page">
          <div>{me.name}</div>
          <div class="muted">{me.role === 'chef' ? '厨师' : '吃饭的人'}</div>
        </PixelBox>
        <PushSetup />
        {me.role === 'chef' && <Members />}
        <Button variant="secondary" onClick={signOut}>退出登录</Button>
      </div>
    </div>
  );
}
