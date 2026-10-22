import { useEffect, useRef, useState } from 'preact/hooks';
import { call, OfflineError, ApiError } from './api.js';
import { storage } from './storage.js';
import { AppContext, useApp } from './store.js';
import { TabBar, TAB_IDS } from './ui/TabBar.jsx';
import { Offline } from './ui/Offline.jsx';
import { Login } from './pages/Login.jsx';
import { Me } from './pages/Me.jsx';
import { Today } from './pages/Today.jsx';
import { Recipes } from './pages/Recipes.jsx';
import { Shopping } from './pages/Shopping.jsx';
import { Stock } from './pages/Stock.jsx';

const TOKEN_KEY = 'pk.token';
const cacheKey = (token) => `pk.view.${token.slice(0, 8)}`;

function readCache(token) {
  try { return JSON.parse(storage.get(cacheKey(token))); } catch { return null; }
}

function tabFromHash() {
  const t = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return TAB_IDS.includes(t) ? t : 'today';
}

// Holds the session, the last server view (cached per account) and the act() used by every page.
export function AppProvider({ children }) {
  const [token, setToken] = useState(() => storage.get(TOKEN_KEY));
  const [view, setView] = useState(() => (token ? readCache(token) : null));
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const viewRef = useRef(view);
  const tokenRef = useRef(token);
  viewRef.current = view;
  tokenRef.current = token;

  const keep = (v, tok = tokenRef.current) => {
    setView(v);
    viewRef.current = v;
    if (tok) storage.set(cacheKey(tok), JSON.stringify(v));
  };

  const signOut = () => {
    const tok = tokenRef.current;
    if (tok) {
      call('auth.logout', {}, tok).catch(() => {});
      storage.remove(cacheKey(tok));
    }
    storage.remove(TOKEN_KEY);
    tokenRef.current = null;
    setToken(null);
    setView(null);
    setOffline(false);
  };

  const signedIn = (tok, v) => {
    storage.set(TOKEN_KEY, tok);
    tokenRef.current = tok;
    setToken(tok);
    keep(v, tok);
    setOffline(false);
  };

  const refresh = async (tok = tokenRef.current) => {
    if (!tok) return;
    setSyncing(true);
    try {
      keep(await call('state.get', {}, tok), tok);
      setOffline(false);
    } catch (err) {
      if (err instanceof OfflineError) setOffline(true);
      else if (err instanceof ApiError && err.status === 401) signOut();
      else throw err;
    } finally {
      setSyncing(false);
    }
  };

  const flash = (uid) => {
    if (!uid) return;
    setHighlight(uid);
    setTimeout(() => setHighlight((h) => (h === uid ? null : h)), 1500);
  };

  // Shows the optimistic view at once; the server's answer replaces it, an error puts the old one back.
  const act = async (action, payload, opts = {}) => {
    const before = viewRef.current;
    if (opts.optimistic && before) {
      const guess = opts.optimistic(before);
      setView(guess);
      viewRef.current = guess;
    }
    try {
      const data = await call(action, payload, tokenRef.current);
      if (data?.me) {
        keep(data);
        flash(typeof opts.highlight === 'function' ? opts.highlight(data, before) : opts.highlight);
      }
      setOffline(false);
      return data;
    } catch (err) {
      setView(before);
      viewRef.current = before;
      if (err instanceof OfflineError) {
        setOffline(true);
        throw new ApiError('OFFLINE', '网络断了，这一下没成功，稍后再试', 0);
      }
      if (err instanceof ApiError && err.status === 401) {
        signOut();
        return undefined;
      }
      throw err;
    }
  };

  useEffect(() => { refresh(token); }, []);

  const value = { view, me: view?.me, token, act, refresh, signOut, signedIn, syncing, offline, highlight, setHighlight: flash };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const PAGES = {
  today: () => <Today />,
  recipes: () => <Recipes />,
  shopping: () => <Shopping />,
  stock: () => <Stock />,
  me: () => <Me />,
};

function Shell() {
  const app = useApp();
  const [tab, setTab] = useState(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!app.token) return <Login onSignedIn={app.signedIn} />;
  if (!app.view) {
    return app.offline
      ? <Offline onRetry={() => app.refresh()} />
      : <div class="page center muted" style={{ paddingTop: '40vh' }}>正在开火……</div>;
  }

  const select = (t) => { window.location.hash = `#/${t}`; setTab(t); };
  const Page = PAGES[tab] ?? PAGES.today;
  return (
    <div>
      {app.syncing && <div class="sync-badge" role="status">同步中</div>}
      {app.offline && <div class="offline-banner" role="alert">连不上服务器，显示的是上次的内容</div>}
      <Page />
      <TabBar current={tab} onSelect={select} />
    </div>
  );
}

export function App() {
  return <AppProvider><Shell /></AppProvider>;
}
