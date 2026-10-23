import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { useAction } from '../lib/useAction.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { Sprite } from '../ui/Sprite.jsx';

// One member with a real-name-verified PushPlus account sends every push; everyone else is that account's
// PushPlus friend and saves their 好友令牌 here (the sender saves their own user token).
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
    const data = await act('me.testPush', {});
    if (data) setMsg(data.message);
  });
  return (
    <PixelBox class="page">
      <div>微信推送 · {me.hasPush ? '已设置' : '还没设置'}</div>
      <p class="muted">推送统一由一位做过 PushPlus 实名认证的成员代发，其他人只要成为 TA 的 PushPlus 好友，不用实名。</p>
      <div class="muted"><b>负责代发的那位</b></div>
      <ol class="muted" style={{ paddingLeft: '18px' }}>
        <li>在公众号「pushplus 推送加」的「个人中心 → 个人资料」里完成实名认证（PushPlus 会收一次认证费）</li>
        <li>把自己的用户 token 填到下面，并让管服务器的人运行一次 <code>scripts/server.sh set-push</code></li>
        <li>打开 <a href="https://www.pushplus.plus/liaison.html" target="_blank" rel="noopener noreferrer">PushPlus「好友消息」页</a>，把好友二维码发给其他人</li>
      </ol>
      <div class="muted"><b>其他人</b></div>
      <ol class="muted" style={{ paddingLeft: '18px' }}>
        <li>微信关注公众号「pushplus 推送加」，再扫代发人发来的好友二维码</li>
        <li>请代发人在「好友消息」页的好友列表里，把你的好友令牌发给你，填到下面</li>
      </ol>
      <label class="field">PushPlus token / 好友令牌
        <input class="px-input" aria-label="PushPlus token" value={token} onInput={(e) => setToken(e.currentTarget.value)} placeholder="32 位字母和数字" />
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
  const { view } = useApp();
  return (
    <PixelBox class="page">
      <div>一起搭伙的人</div>
      <p class="muted">{view.users.map((u) => u.name).join('、')}</p>
      <p class="muted">有人忘了口令？请管服务器的那位在电脑上帮忙重置。</p>
    </PixelBox>
  );
}

export function Me() {
  const { me, signOut } = useApp();
  return (
    <div>
      <Header title="我的" subtitle={me.name} icon="hat" />
      <div class="page">
        <Button class="big-btn icon-btn" variant="secondary" onClick={() => { window.location.hash = '#/history'; }}>
          <Sprite name="scroll" scale={2} />吃饭记录
        </Button>
        <PushSetup />
        <Members />
        <Button variant="secondary" onClick={signOut}>退出登录</Button>
      </div>
    </div>
  );
}
