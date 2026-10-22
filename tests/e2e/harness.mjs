// Boots a throwaway n8n (folder .n8n-test, port 5679) with the generated workflows.
import { spawn, execFileSync } from 'node:child_process';
import { openSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 5679;
// PK_E2E_BASE points at an n8n that is already running with the workflows loaded (the server e2e run).
const EXTERNAL = process.env.PK_E2E_BASE;
export const BASE = EXTERNAL ?? `http://localhost:${PORT}`;

function env() {
  const out = execFileSync('bash', ['-c', `. "${REPO}/scripts/n8n-env.sh" && env -0`], { encoding: 'utf8' });
  return Object.fromEntries(out.split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

async function waitHealthy(deadline) {
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('n8n did not become healthy in time');
}

export async function startN8n() {
  let proc = null;
  if (!EXTERNAL) {
    const e = env();
    rmSync(e.N8N_USER_FOLDER, { recursive: true, force: true });
    execFileSync('bash', [`${REPO}/scripts/deploy-local.sh`, 'test'], { env: e, stdio: 'ignore' });
    const log = openSync(path.join(e.N8N_USER_FOLDER, 'e2e.log'), 'w');
    proc = spawn(e.N8N_BIN, ['start'], { env: e, stdio: ['ignore', log, log] });
  }
  await waitHealthy(Date.now() + 120_000);
  // Webhooks register shortly after /healthz turns green; the setup webhook creates the tables.
  let setup;
  for (let i = 0; i < 40; i++) {
    setup = await fetch(`${BASE}/webhook/pk-setup`, { method: 'POST' });
    if (setup.status !== 404) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  if (setup.status !== 200) throw new Error(`table setup failed: ${setup.status} ${await setup.text()}`);
  const seeded = await fetch(`${BASE}/webhook/pk-seed`, { method: 'POST' });
  if (seeded.status !== 200) throw new Error(`seed failed: ${seeded.status} ${await seeded.text()}`);
  return {
    async api(action, payload = {}, token = '') {
      const r = await fetch(`${BASE}/webhook/pk/api`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, token, payload }),
      });
      return { status: r.status, body: await r.json() };
    },
    stop: () => (proc ? new Promise((resolve) => { proc.once('exit', resolve); proc.kill('SIGTERM'); }) : Promise.resolve()),
  };
}
