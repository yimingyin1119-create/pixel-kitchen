export function PixelBox({ class: cls = '', children, ...rest }) {
  return <div class={`px-box ${cls}`} {...rest}>{children}</div>;
}

export function Button({ variant = '', class: cls = '', children, ...rest }) {
  return <button type="button" class={`px-btn ${variant} ${cls}`} {...rest}>{children}</button>;
}
