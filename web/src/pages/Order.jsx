import { useState } from 'preact/hooks';
import { useApp } from '../store.js';
import { storage } from '../storage.js';
import { Header } from '../ui/Header.jsx';
import { DishCard } from '../ui/DishCard.jsx';
import { Checkout } from '../ui/Checkout.jsx';
import { Toast } from '../ui/Toast.jsx';
import { PixelBox, Button } from '../ui/PixelBox.jsx';
import { ChefQueue } from './ChefQueue.jsx';
import { today, dateLabel, weekday } from '../lib/time.js';

const CART_KEY = 'pk.cart';

function loadCart() {
  try { return JSON.parse(storage.get(CART_KEY) ?? '[]'); } catch { return []; }
}

export function Order() {
  const { view, me, act } = useApp();
  const [cart, setCartState] = useState(loadCart);
  const [checkout, setCheckout] = useState(false);
  const [toast, setToast] = useState('');

  const dishes = view.recipes
    .filter((r) => r.zone === 'signature' && !r.archived)
    .sort((a, b) => (view.dishCounts[b.uid] ?? 0) - (view.dishCounts[a.uid] ?? 0));
  const inCart = cart.filter((uid) => dishes.some((d) => d.uid === uid));

  const setCart = (next) => {
    setCartState(next);
    storage.set(CART_KEY, JSON.stringify(next));
  };
  const toggle = (uid) => setCart(inCart.includes(uid) ? inCart.filter((u) => u !== uid) : [...inCart, uid]);

  const place = async (details) => {
    const data = await act('orders.place', { items: inCart, ...details });
    if (!data) return;
    setCart([]);
    setCheckout(false);
    setToast('下单成功，等厨师接单');
  };

  const d = today();
  return (
    <div>
      <Header subtitle={`今日 · ${dateLabel(d)} ${weekday(d)}`} />
      <Toast text={toast} onDone={() => setToast('')} />
      <div class="page">
        {me.role === 'chef' && <ChefQueue />}
        <div class="section-title">拿手菜</div>
        {dishes.length === 0 && <p class="muted">厨师还没录拿手菜，去「菜谱」里加一道吧</p>}
        {dishes.map((r) => (
          <DishCard key={r.uid} recipe={r} count={view.dishCounts[r.uid] ?? 0} missing={view.availability[r.uid]?.missing ?? []}
            selected={inCart.includes(r.uid)} onToggle={() => toggle(r.uid)} />
        ))}
        <div style={{ height: '60px' }} />
      </div>
      {inCart.length > 0 && (
        <div class="cart-bar">
          <PixelBox>
            <span>已选 {inCart.length} 道</span>
            <Button onClick={() => setCheckout(true)}>去下单</Button>
          </PixelBox>
        </div>
      )}
      {checkout && <Checkout count={inCart.length} onSubmit={place} onClose={() => setCheckout(false)} />}
    </div>
  );
}
