// Builders for the n8n nodes this project uses. Parameter names follow
// n8n-nodes-base/dist/node-definitions/nodes/n8n-nodes-base/<node>/v*.ts for n8n 2.44.
import { sha256Hex } from '../../core/sha256.js';

const COL = 260;
const ROW = 160;

function uuid(seed) {
  const h = sha256Hex(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function cond(id, leftValue, operator, rightValue) {
  return {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{ id: uuid(id), leftValue, rightValue, operator }],
    combinator: 'and',
  };
}

const IS_TRUE = { type: 'boolean', operation: 'true', singleValue: true };
const EQUALS = { type: 'string', operation: 'equals' };

export function builders({ workflowId, core, cfg }) {
  const node = (name, type, typeVersion, parameters, [col, row], extra = {}) => ({
    id: uuid(`${workflowId}:${name}`), name, type, typeVersion, position: [col * COL, row * ROW], parameters, ...extra,
  });
  const table = (t) => ({ __rl: true, mode: 'name', value: t });

  return {
    webhook: (name, path, pos) =>
      node(name, 'n8n-nodes-base.webhook', 2.1, {
        httpMethod: 'POST', path, responseMode: 'responseNode', options: { allowedOrigins: cfg.allowedOrigins },
      }, pos, { webhookId: uuid(`webhook:${path}`) }),

    execTrigger: (name, pos) =>
      node(name, 'n8n-nodes-base.executeWorkflowTrigger', 1.1, { inputSource: 'passthrough' }, pos),

    manualTrigger: (name, pos) => node(name, 'n8n-nodes-base.manualTrigger', 1, {}, pos),

    execWorkflow: (name, id, { wait }, pos) =>
      node(name, 'n8n-nodes-base.executeWorkflow', 1.2, {
        source: 'database', workflowId: { __rl: true, mode: 'id', value: id }, mode: 'once',
        options: { waitForSubWorkflow: wait },
      }, pos),

    cryptoRand: (name, pos) =>
      node(name, 'n8n-nodes-base.crypto', 2, {
        action: 'generate', encodingType: 'hex', stringLength: 64, dataPropertyName: 'rand',
      }, pos),

    dtGetAll: (t, pos) =>
      node(`读取 ${t}`, 'n8n-nodes-base.dataTable', 1.1, {
        resource: 'row', operation: 'get', dataTableId: table(t), returnAll: true,
      }, pos, { executeOnce: true, alwaysOutputData: true }),

    dtUpsert: (t, pos) =>
      node(`写入 ${t}`, 'n8n-nodes-base.dataTable', 1.1, {
        resource: 'row', operation: 'upsert', dataTableId: table(t), matchType: 'allConditions',
        filters: { conditions: [{ keyName: 'uid', condition: 'eq', keyValue: '={{ $json.uid }}' }] },
        columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
        options: {},
      }, pos),

    dtCreate: (t, columns, pos) =>
      node(`建表 ${t}`, 'n8n-nodes-base.dataTable', 1.1, {
        resource: 'table', operation: 'create', tableName: t,
        columns: { column: Object.entries(columns).map(([name, type]) => ({ name, type: type === 'json' ? 'string' : type })) },
        options: { createIfNotExists: true },
      }, pos, { executeOnce: true }),

    dtDeleteTable: (t, pos) =>
      node(`删表 ${t}`, 'n8n-nodes-base.dataTable', 1.1, {
        resource: 'table', operation: 'delete', dataTableId: table(t),
      }, pos, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),

    code: (name, body, pos, { withCore = false } = {}) =>
      node(name, 'n8n-nodes-base.code', 2, {
        mode: 'runOnceForAllItems', language: 'javaScript', jsCode: withCore ? `${core}\n${body}` : body,
      }, pos),

    ifTrue: (name, expr, pos) =>
      node(name, 'n8n-nodes-base.if', 2.2, { conditions: cond(`${workflowId}:${name}`, expr, IS_TRUE), options: {} }, pos),

    switchOn: (name, expr, cases, pos) =>
      node(name, 'n8n-nodes-base.switch', 3.2, {
        mode: 'rules',
        rules: {
          values: cases.map(([value, label]) => ({
            conditions: cond(`${workflowId}:${name}:${value}`, expr, EQUALS, value), renameOutput: true, outputKey: label,
          })),
        },
        options: {},
      }, pos),

    setFields: (name, fields, pos) =>
      node(name, 'n8n-nodes-base.set', 3.4, {
        mode: 'manual',
        assignments: {
          assignments: Object.entries(fields).map(([k, value]) => ({ id: uuid(`${workflowId}:${name}:${k}`), name: k, value, type: 'string' })),
        },
        includeOtherFields: false, options: {},
      }, pos),

    httpPostJson: (name, url, jsonBody, pos, { continueOnError = false } = {}) =>
      node(name, 'n8n-nodes-base.httpRequest', 4.2, {
        method: 'POST', url, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody, options: {},
      }, pos, continueOnError ? { onError: 'continueRegularOutput' } : {}),

    respond: (name, { fromNode, status } = {}, pos) => {
      const src = fromNode ? `$('${fromNode}').first().json` : '$json';
      return node(name, 'n8n-nodes-base.respondToWebhook', 1.5, {
        respondWith: 'json', responseBody: `={{ ${fromNode ? `${src}.body` : '$json.body'} }}`,
        options: { responseCode: status ?? `={{ ${src}.status }}` },
      }, pos);
    },

    sticky: (text, [col, row], [w, h], color = 4) =>
      node(`便签 ${sha256Hex(text).slice(0, 6)}`, 'n8n-nodes-base.stickyNote', 1,
        { content: text, width: w * COL - 40, height: h * ROW - 20, color }, [col, row]),
  };
}

// connect(['A', 'B'], ['B', 'C', 1]) — optional third item is the source output index.
export function connect(...links) {
  const out = {};
  for (const [from, to, index = 0] of links) {
    const main = (out[from] ??= { main: [] }).main;
    while (main.length <= index) main.push([]);
    main[index].push({ node: to, type: 'main', index: 0 });
  }
  return out;
}

// No workflow keeps successful runs (they would hold tokens, pin hashes and photos);
// `secret` workflows, which read sessions, keep no failed runs either.
export function workflow({ id, name, nodes, connections, cfg, secret = false }) {
  return {
    id, name, nodes, connections, active: false, pinData: {},
    settings: {
      executionOrder: 'v1', timezone: cfg.timezone, saveManualExecutions: false, callerPolicy: 'workflowsFromSameOwner',
      saveDataSuccessExecution: 'none',
      ...(secret ? { saveDataErrorExecution: 'none' } : {}),
    },
    versionId: sha256Hex(JSON.stringify(nodes)).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5'),
  };
}
