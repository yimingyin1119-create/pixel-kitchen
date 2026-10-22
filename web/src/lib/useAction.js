import { useState } from 'preact/hooks';

// Wraps one button's work: ignores taps while busy and keeps the server's message for display.
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    if (pending) return undefined;
    setPending(true);
    setError('');
    try {
      return await fn();
    } catch (err) {
      setError(err?.message || '出错了，再试一次');
      return undefined;
    } finally {
      setPending(false);
    }
  };
  return [run, pending, error, setError];
}
