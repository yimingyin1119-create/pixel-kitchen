import { Header } from '../ui/Header.jsx';
import { Sprite } from '../ui/Sprite.jsx';

export function Placeholder({ title, sprite = 'pot' }) {
  return (
    <div>
      <Header subtitle={title} />
      <div class="page center" style={{ paddingTop: '20vh' }}>
        <Sprite name={sprite} scale={6} />
        <p class="muted">这一页还在做，很快就好</p>
      </div>
    </div>
  );
}
