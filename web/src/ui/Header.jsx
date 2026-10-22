import { BRAND } from '../copy.js';

export function Header({ title = BRAND, subtitle }) {
  return (
    <header>
      <div class="awning" />
      <div class="title-bar">
        <h1>{title}</h1>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </header>
  );
}
