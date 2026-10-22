// Bottom sheet over a dimmed backdrop.
export function Sheet({ title, onClose, children }) {
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet px-box" role="dialog" aria-label={title}>
        <div class="row" style={{ justifyContent: 'space-between' }}>
          <strong style={{ fontWeight: 'normal', fontSize: '17px' }}>{title}</strong>
          <button type="button" class="sheet-close" aria-label="关闭" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
