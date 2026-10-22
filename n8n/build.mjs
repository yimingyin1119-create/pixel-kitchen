// Generates n8n workflow JSON from code: node n8n/build.mjs --env test|prod
import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import auth from './workflows/auth.mjs';
import api from './workflows/api.mjs';
import notify from './workflows/notify.mjs';
import setup from './workflows/setup.mjs';
import reset from './workflows/reset.mjs';
import seed from './workflows/seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS = [auth, api, notify, setup, reset, seed];

async function coreBundle() {
  const out = await build({
    entryPoints: [path.join(here, '../core/n8n-entry.js')], bundle: true, format: 'iife',
    target: 'node20', write: false, minify: true, legalComments: 'none',
  });
  return `var PK;\nconst PK_SINK = (api) => { PK = api; };\n${out.outputFiles[0].text.trim()}`;
}

export async function buildAll(env, { write = true } = {}) {
  const cfg = JSON.parse(await readFile(path.join(here, `config.${env}.json`), 'utf8'));
  const core = await coreBundle();
  const seedRecipes = JSON.parse(await readFile(path.join(here, '../seed/recipes.json'), 'utf8'));
  const workflows = WORKFLOWS.map((make) => make({ core, cfg, seedRecipes }));
  if (write) {
    const dist = path.join(here, 'dist');
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    for (const w of workflows) await writeFile(path.join(dist, `${w.id}.json`), JSON.stringify(w, null, 2));
  }
  return workflows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--env');
  const env = i > 0 ? process.argv[i + 1] : 'test';
  const workflows = await buildAll(env);
  console.log(`built ${workflows.length} workflows (${env}) → n8n/dist`);
}
