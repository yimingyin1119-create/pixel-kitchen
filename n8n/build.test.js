import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAll } from './build.mjs';
import { TABLES } from '../core/schema.js';

const workflows = await buildAll('test', { write: false });
const byId = Object.fromEntries(workflows.map((w) => [w.id, w]));
const api = byId.pkApi00000000001;
const nodes = (wf, type) => wf.nodes.filter((n) => n.type === type);
const node = (wf, name) => wf.nodes.find((n) => n.name === name);

test('builds the M1 workflows', () => {
  for (const id of ['pkAuth0000000001', 'pkApi00000000001', 'pkNotify00000001', 'pkSetup000000001', 'pkReset000000001', 'pkSeed0000000001']) {
    assert.ok(byId[id], id);
  }
});

test('api writes every table', () => {
  const dt = nodes(api, 'n8n-nodes-base.dataTable');
  const gets = dt.filter((n) => n.parameters.operation === 'get').map((n) => n.parameters.dataTableId.value).sort();
  const upserts = dt.filter((n) => n.parameters.operation === 'upsert').map((n) => n.parameters.dataTableId.value).sort();
  assert.deepEqual(gets, Object.keys(TABLES).sort());
  assert.deepEqual(upserts, Object.keys(TABLES).sort());
});

test('respond is bottom-most branch', () => {
  const targets = (api.connections['业务处理']?.main ?? []).flat().map((c) => node(api, c.node));
  const respond = targets.find((n) => n.type === 'n8n-nodes-base.respondToWebhook');
  assert.ok(respond, 'respond hangs off 业务处理');
  for (const n of targets) if (n !== respond) assert.ok(n.position[1] < respond.position[1], n.name);
});

test('core inlined only where needed', () => {
  const withCore = workflows.flatMap((w) => w.nodes.filter((n) => n.parameters?.jsCode?.includes('var PK')).map((n) => n.name));
  assert.deepEqual(withCore.sort(), ['业务处理', '业务处理', '准备预设', '核对会话'].sort());
});

test('core works inside the n8n sandbox, where Object.defineProperty is a no-op', () => {
  const code = node(api, '业务处理').parameters.jsCode;
  const prefix = code.slice(0, code.indexOf("\nconst req = $('收到请求')"));
  const run = new Function('Object', `${prefix}\nreturn PK;`);
  const SandboxObject = new Proxy(Object, { get: (o, k) => (k === 'defineProperty' ? () => ({}) : o[k]) });
  const PK = run(SandboxObject);
  assert.equal(typeof PK.handle, 'function');
  assert.equal(typeof PK.stateFromTables, 'function');
  assert.equal(Object.keys(PK.TABLES).length, 7);
});

test('every workflow has a sticky note and chinese names', () => {
  for (const w of workflows) {
    assert.ok(nodes(w, 'n8n-nodes-base.stickyNote').length > 0, w.name);
    for (const n of w.nodes) if (n.type !== 'n8n-nodes-base.stickyNote') assert.match(n.name, /[一-鿿]/, n.name);
  }
});

test('connections point at real nodes', () => {
  for (const w of workflows) {
    const names = new Set(w.nodes.map((n) => n.name));
    for (const [from, out] of Object.entries(w.connections)) {
      assert.ok(names.has(from), `${w.name}: ${from}`);
      for (const c of out.main.flat()) assert.ok(names.has(c.node), `${w.name}: ${c.node}`);
    }
  }
});

test('webhook workflows do not save success data', () => {
  for (const w of workflows) {
    assert.equal(w.settings.executionOrder, 'v1');
    if (nodes(w, 'n8n-nodes-base.webhook').length) assert.equal(w.settings.saveDataSuccessExecution, 'none', w.name);
  }
});

test('webhook origins from config', () => {
  assert.equal(nodes(api, 'n8n-nodes-base.webhook')[0].parameters.options.allowedOrigins, '*');
});

test('push goes to configured url', () => {
  const http = nodes(byId.pkNotify00000001, 'n8n-nodes-base.httpRequest')[0];
  assert.equal(http.parameters.url, 'http://127.0.0.1:5690/pushplus/send');
  assert.equal(http.onError, 'continueRegularOutput');
});

test('no secrets in dist', () => assert.ok(!JSON.stringify(workflows).includes('sk-ant')));

test('seed and reset are internal paths', () => {
  for (const id of ['pkSetup000000001', 'pkReset000000001', 'pkSeed0000000001']) {
    const path = nodes(byId[id], 'n8n-nodes-base.webhook')[0].parameters.path;
    assert.ok(!path.startsWith('pk/'), path);
  }
});

test('reset deletes every table and keeps going if one is missing', () => {
  const del = nodes(byId.pkReset000000001, 'n8n-nodes-base.dataTable').filter((n) => n.parameters.operation === 'delete');
  assert.deepEqual(del.map((n) => n.parameters.dataTableId.value).sort(), Object.keys(TABLES).sort());
  for (const n of del) assert.equal(n.onError, 'continueRegularOutput');
});

test('seed recipes are inlined', () => {
  const prep = node(byId.pkSeed0000000001, '准备预设').parameters.jsCode;
  assert.ok(prep.includes('红烧肉') && prep.includes('清炒菜心'));
});

test('notify has seven branches', () => {
  const sw = nodes(byId.pkNotify00000001, 'n8n-nodes-base.switch')[0];
  assert.deepEqual(sw.parameters.rules.values.map((v) => v.outputKey),
    ['新要求', '有人接了', '做不了', '被取消', '出锅了', '快用完了', '测试推送']);
});

test('register and login skip the login check', () => {
  const expr = node(api, '是登录类操作？').parameters.conditions.conditions[0].leftValue;
  assert.match(expr, /'auth\.register'/);
  assert.match(expr, /'auth\.login'/);
  assert.doesNotMatch(expr, /auth\.setup/);
});

test('no workflow keeps successful executions', () => {
  for (const w of workflows) assert.equal(w.settings.saveDataSuccessExecution, 'none', w.name);
});

test('workflows that read sessions keep no error data either', () => {
  for (const id of ['pkApi00000000001', 'pkAuth0000000001', 'pkAdmin000000001']) {
    assert.equal(byId[id].settings.saveDataErrorExecution, 'none', id);
  }
});

test('admin endpoint is internal and the only one that sets ctx.internal', () => {
  const admin = byId.pkAdmin000000001;
  assert.equal(nodes(admin, 'n8n-nodes-base.webhook')[0].parameters.path, 'pk-admin');
  assert.match(node(admin, '业务处理').parameters.jsCode, /internal: true/);
  assert.doesNotMatch(node(api, '业务处理').parameters.jsCode, /internal: true/);
});
