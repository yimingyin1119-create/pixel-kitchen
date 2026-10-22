export function Header({ title = '乡村小厨', subtitle }) {
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
