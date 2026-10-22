import { useState } from 'preact/hooks';
import { Button } from './PixelBox.jsx';

// Pixel number pad; submits as soon as four digits are entered.
export function PinPad({ onSubmit, disabled = false }) {
  const [pin, setPin] = useState('');
  const press = (d) => {
    const next = (pin + d).slice(0, 4);
    if (next.length === 4) {
      setPin('');
      onSubmit(next);
    } else {
      setPin(next);
    }
  };
  return (
    <div>
      <div class="pin-dots" aria-label={`已输入 ${pin.length} 位`}>
        {[0, 1, 2, 3].map((i) => <span key={i} class={i < pin.length ? 'on' : ''} />)}
      </div>
      <div class="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Button key={d} variant="secondary" disabled={disabled} onClick={() => press(d)}>{d}</Button>
        ))}
        <span />
        <Button variant="secondary" disabled={disabled} onClick={() => press('0')}>0</Button>
        <Button variant="secondary" disabled={disabled} aria-label="删除" onClick={() => setPin(pin.slice(0, -1))}>←</Button>
      </div>
    </div>
  );
}
