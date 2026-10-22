import { useEffect, useState } from 'preact/hooks';
import { call, OfflineError, ApiError } from './api.js';
import { storage } from './storage.js';
import { AppContext } from './store.js';
import { TabBar, CHEF_TABS } from './ui/TabBar.jsx';
import { Offline } from './ui/Offline.jsx';
import { Login } from './pages/Login.jsx';
import { Me } from './pages/Me.jsx';
import { Placeholder } from './pages/Placeholder.jsx';

const TOKEN_KEY = 'pk.token';

function tabFromHash() {
  const t = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return CHEF_TABS.includes(t) ? t : 'order';
}

const PAGES = {
  order: () => <Placeholder title="点菜" sprite="bowl" />,
  recipes: () => <Placeholder title="菜谱" sprite="pot" />,
  shopping: () => <Placeholder title="采购" sprite="cart" />,
  inventory: () => <Placeholder title="食材库" sprite="fridge" />,
  me: () => <Me />,
};

export function App() {
  const [token, setToken] = useState(() => storage.get(TOKEN_KEY));
  const [view, setView] = useState(null);
  const [status, setStatus] = useState(token ? 'loading' : 'login'); // login | setup | loading | ready | offline
  const [tab, setTab] = useState(tabFromHash);

  const signOut = () => {
    if (token) call('auth.logout', {}, token).catch(() => {});
    storage.remove(TOKEN_KEY);
    setToken(null);
    setView(null);
    setStatus('login');
  };

  // Offline and expired sessions are handled here; other API errors go back to the page that asked.
  const guard = (err) => {
    if (err instanceof OfflineError) setStatus('offline');
    else if (err instanceof ApiError && err.status === 401) signOut();
    else throw err;
  };

  const refresh = async (tok = token) => {
    setStatus('loading');
    try {
      setView(await call('state.get', {}, tok));
      setStatus('ready');
    } catch (err) {
      guard(err);
    }
  };

  const act = async (action, payload) => {
    try {
      const data = await call(action, payload, token);
      if (data?.me) setView(data);
      return data;
    } catch (err) {
      guard(err);
      return undefined;
    }
  };

  useEffect(() => {
    if (token) refresh(token);
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const signedIn = (tok, v) => {
    storage.set(TOKEN_KEY, tok);
    setToken(tok);
    setView(v);
    setStatus('ready');
  };

  if (status === 'login' || status === 'setup') {
    return (
      <Login key={status} mode={status} onSignedIn={signedIn} onNoUsers={() => setStatus('setup')} />
    );
  }
  if (status === 'offline') return <Offline onRetry={() => refresh()} />;
  if (status === 'loading' || !view) return <div class="page center muted" style={{ paddingTop: '40vh' }}>正在开火……</div>;

  const select = (t) => { window.location.hash = `#/${t}`; setTab(t); };
  const Page = PAGES[tab] ?? PAGES.order;
  return (
    <AppContext.Provider value={{ view, token, me: view.me, refresh, act, signOut }}>
      <Page />
      <TabBar role={view.me.role} current={tab} onSelect={select} />
    </AppContext.Provider>
  );
}
