import { storage } from './storage.js';

const API_KEY = 'pk.api';

export class OfflineError extends Error {}

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Production builds use the fixed server address; `?api=` only overrides it during development.
export function getApiBase() {
  if (import.meta.env.DEV) {
    const url = new URL(window.location.href);
    const override = url.searchParams.get('api');
    if (override) {
      storage.set(API_KEY, override);
      url.searchParams.delete('api');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    const saved = storage.get(API_KEY);
    if (saved) return saved;
  }
  return import.meta.env.VITE_API_BASE ?? '';
}

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${getApiBase()}/webhook/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch {
    throw new OfflineError('网络连不上');
  }
  let json;
  try { json = await res.json(); } catch { throw new OfflineError('服务器没有正常回应'); }
  if (!json.ok) throw new ApiError(json.error?.code ?? 'UPSTREAM', json.error?.message ?? '出错了', res.status);
  return json.data;
}

export function call(action, payload, token) {
  return post('pk/api', { action, token, payload });
}

export function postAi(kind, body, token) {
  return post(`pk/${kind}`, { ...body, token });
}
