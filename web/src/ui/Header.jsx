import { BRAND } from '../copy.js';
import { Sprite } from './Sprite.jsx';

export function Header({ title = BRAND, subtitle, icon }) {
  return (
    <header>
      <div class="awning" />
      <div class="title-bar">
        {icon && <Sprite name={icon} scale={3} />}
        <div>
          <h1>{title}</h1>
          {subtitle && <small>{subtitle}</small>}
        </div>
      </div>
    </header>
  );
}
