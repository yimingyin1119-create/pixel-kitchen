import { useApp } from '../store.js';
import { Header } from '../ui/Header.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';

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
        <Button variant="secondary" onClick={signOut}>退出登录</Button>
      </div>
    </div>
  );
}
