import { useEffect } from 'preact/hooks';

export function Toast({ text, onDone, ms = 2500 }) {
  useEffect(() => {
    if (!text) return undefined;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [text]);
  return text ? <div class="toast px-box" role="status">✦ {text}</div> : null;
}
