import { Sprite } from './Sprite.jsx';
import { Button } from './PixelBox.jsx';

export function Offline({ onRetry }) {
  return (
    <div class="page center" style={{ paddingTop: '30vh' }}>
      <div class="row" style={{ justifyContent: 'center' }}><Sprite name="cat" scale={6} /></div>
      <h2 style={{ fontWeight: 'normal' }}>厨房打烊了</h2>
      <p class="muted">服务器连不上，稍后再试</p>
      <Button onClick={onRetry}>再试一次</Button>
    </div>
  );
}
