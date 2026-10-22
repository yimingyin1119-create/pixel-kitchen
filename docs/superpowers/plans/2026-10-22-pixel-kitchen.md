# 乡村小厨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个在微信里打开的像素风点餐 + 厨房管理网页：点菜 → 厨师微信收到推送 → 做好自动扣库存 → 缺料进采购清单 → 买回入库；AI 从链接/多张截图拆菜谱、拍小票入库；每日 menu、徽章、排行榜。n8n 流程清晰可读，可放进作品集。

**Architecture:** 容易算错的规则（鉴权、换算、扣库存、采购合并、徽章、推荐）写在零依赖纯 JS 模块 `core/`，TDD；核心入口 `handle(action, state, payload, ctx)`。n8n 负责可读的自动化流程：「点餐接口」「登录校验（子流程）」「通知中心」「导入菜谱」「小票入库」「每日早报」「建表」，中文节点名 + 便签；需要计算的 Code 节点内联 esbuild 打包的 `core`。工作流 JSON 由 `n8n/build.mjs` 生成并用 n8n CLI 导入。生产环境第一天就在欧洲 VPS 上用 Docker 跑 n8n，Caddy 提供 HTTPS 且只放行 `/webhook/pk/*`；前端 Vite + Preact 静态站部署到 GitHub Pages，后端地址构建时写死。

**Tech Stack:** Node 24、n8n 2.44.6（Data Tables、task runners）、esbuild、Docker Compose、Caddy 2、Vite + Preact、Vitest + @testing-library/preact、Claude API（`claude-haiku-5-5`，原生 HTTP）、PushPlus、Fusion Pixel 12px。

**Spec:** `docs/superpowers/specs/2026-10-22-pixel-kitchen-design.md`（执行者两份都要读，第 8 节里程碑顺序是硬要求）

## Global Constraints

- 仓库根：`/Users/yinyiming/Documents/Claude/pixel-kitchen`；`git init`；`.gitignore` 含 `node_modules/ .n8n-test/ .superpowers/ dist/ n8n/dist/ .env* deploy/.env backups/`。
- Node ≥ 24；n8n 锁 `2.44.6`：本地测试装在 `n8n/runtime/`，生产用镜像 `n8nio/n8n:2.44.6`。Mac 无 Homebrew，npm 全局目录 `~/.npm-global`。
- **里程碑门槛**：M1（Task 1–10）、M2（11–13）、M3（14–15）、M4（16–18）。每个里程碑最后一步是用户微信真机验收；没过不进入下一个里程碑。
- 时区 `Europe/Amsterdam`；“今天”= 该时区日期。界面简体中文，标题「乡村小厨」。
- 视觉方向 A · 暖木农舍，token 精确值：`--cream #f6e7c8`、`--ink-wood #6b3f1d`（像素描边）、`--wood #a0683a`、`--wood-dark #8b5a2b`、`--tomato #c8423a`、`--milk #fff6e6`、`--paper #fffaf0`、`--gold #f2b33d`、`--leaf #5c8a3a`、`--text #4a2f1a`、缺料标签 底 `#e9d3a8` 字 `#8a3a2a`。3px 缺角像素框（box-shadow 四向 3px）。格子棚 `repeating-linear-gradient(90deg,#c8423a 0 14px,#fff6e6 14px 28px)` 高 14px。样稿：`.superpowers/brainstorm/18164-1792680910/content/visual-style.html` 卡片 A（含可复用的像素小图渲染器）。
- 字体 Fusion Pixel 12px 简体（OFL-1.1），子集化（ASCII + GB2312 一级字 + 用到的符号）woff2 自托管，附 `OFL.txt`。
- Claude：`claude-haiku-5-5`；`POST https://api.anthropic.com/v1/messages`；头 `anthropic-version: 2026-10-21`、`x-api-key`（n8n 凭据 Header Auth，名 `Anthropic API`，id `pkAnthropicCred1`）；`output_config: {effort:"low", format:{type:"json_schema", schema}}`；**不得**发送 `temperature/top_p/top_k/thinking.budget_tokens`；`max_tokens: 16000`；先判断 `stop_reason`（`refusal`/`max_tokens` 视为失败），取第一个 `type==="text"` 块解析 JSON。key 只存在 n8n 凭据里，不进前端、git、日志、聊天。
- PushPlus：`POST https://www.pushplus.plus/send`，`{token, title, content, template:"txt"}`；HTTP 节点 `onError: continueRegularOutput`，推送失败不影响业务。
- n8n 运行环境变量（本地测试与生产一致）：`GENERIC_TIMEZONE=Europe/Amsterdam`、`N8N_CONCURRENCY_PRODUCTION_LIMIT=1`、`EXECUTIONS_DATA_PRUNE=true`、`EXECUTIONS_DATA_MAX_AGE=168`、`N8N_DIAGNOSTICS_ENABLED=false`、`N8N_PERSONALIZATION_ENABLED=false`。所有 webhook 工作流 `settings: {executionOrder:'v1', saveDataSuccessExecution:'none', saveManualExecutions:false, timezone:'Europe/Amsterdam'}`。
- 生产：VPS（用户购买，助手不付款）上 Docker Compose：`n8n`（端口只绑 `127.0.0.1:5678`）+ `caddy`（80/443）。Caddy 只代理 `/webhook/pk/*`，其余 404。域名默认 `<ip用短横线>.sslip.io`，证书失败则请用户买域名。编辑器只通过 `ssh -L 5678:127.0.0.1:5678` 访问。
- Data Table 名 `pk_` 前缀；不可占用系统列 `id/createdAt/updatedAt`；主键列 `uid`，时间列 `createdIso/updatedIso`。
- 登录：名字 + 4 位数字口令；连错 5 次锁 15 分钟；会话 30 天。
- 早报 09:00；临期 = 保质期距今天 ≤ 3 天；“很久没人点” = 30 天。
- 想吃时间结构化：`wantedDate:'YYYY-MM-DD'`（≥ 今天）、`meal:'lunch'|'dinner'|'late'`、`wantedTime:'HH:MM'|''`。
- 菜谱图片导入一次最多 6 张，每张前端压到长边 ≤ 1568px JPEG。
- 前端构建目标 `['es2019','safari13']`；所有 localStorage 读写包 try/catch。
- API 响应：`{ok:true, data}` 或 `{ok:false, error:{code, message}}`（message 中文）。码 → 状态：`BAD_INPUT 400`、`UNAUTHORIZED 401`、`FORBIDDEN 403`、`NOT_FOUND 404`、`NO_USERS 404`、`CONFLICT 409`、`NEEDS_IMAGES 422`、`NEEDS_FALLBACK 422`、`LOCKED 423`、`UPSTREAM 502`。
- n8n 画布可读性（作品集要求）：节点中文命名；`n8n/lib/layout.mjs` 按列/行网格自动排版（列距 260、行距 160，主流程从左到右）；每个工作流至少一个便签（`n8n-nodes-base.stickyNote`）说明用途。

## Review Focus

1. **重复点击**：“做好了”连点两次、已取消的单被接单 → 第二次 `CONFLICT`，库存只扣一次、次数只加一次。测试：Task 5 `done is idempotent`、`accept cancelled order conflicts`。
2. **两人同时写**：厨师入库与他人下单同时到达 → 两边改动都保留（靠并发上限 1 排队）。测试：Task 6 e2e `concurrent writes both land`。
3. **单位对不上**：菜谱“番茄 2 个”、库存按克 → 不扣、不出 NaN，订单缺料标 `unitMismatch`。测试：Task 5 `unit mismatch is flagged not deducted`。
4. **拒单/取消留下幽灵采购项**：订单带来的采购量在拒单/取消后退回，只剩该原因时采购项消失。测试：Task 5 `cancel unwinds shopping`。
5. **公网暴力猜口令 / AI 返回垃圾 / 服务器不可达**：5 次错锁定（Task 2 `lockout after five failures`）；Claude 拒答、截断、非菜谱 → 中文提示且不入库（Task 11 `refusal yields error`、Task 12 e2e `xhs link without images asks for screenshots`）；网络失败显示“厨房打烊了”，购物车保留（Task 8 `offline screen on network error`、Task 9 `cart survives reload`）。

---

## 共享数据模型（各任务引用，不再重复）

`core/schema.js` 导出 `TABLES`：列 → `string|number|boolean|json`（json 存为 string）。

| 表 | 列 |
|---|---|
| `pk_users` | `uid, name, role('chef'|'diner'), pinSalt, pinHash, pushToken, avatar, failedLogins:number, lockedUntilIso, createdIso` |
| `pk_sessions` | `uid(=token), userUid, expiresIso` |
| `pk_recipes` | `uid, name, zone('signature'|'wish'), imageUrl, sourceUrl, baseServings:number, ingredients:json, steps:json, tags:json, wishVotes:json, createdBy, createdIso, archived:boolean` |
| `pk_inventory` | `uid, name, aliases:json, kind('main'|'seasoning'), qty:number, unit, lowThreshold:number, status('ok'|'low'|'out'), expiresOn, stockedIso` |
| `pk_orders` | `uid, userUid, items:json([{recipeUid,name}]), servings:number, wantedDate, meal, wantedTime, note, status('pending'|'accepted'|'done'|'rejected'|'cancelled'), rejectReason, needs:json, shortages:json, createdIso, updatedIso` |
| `pk_shopping` | `uid, name, inventoryUid, qty:number, unit, reasons:json([{type:'order'|'low'|'manual', orderUid?, qty}]), done:boolean, boughtQty:number, doneIso, removed:boolean` |
| `pk_menu` | `uid(='YYYY-MM-DD'), recipeUids:json, updatedIso` |

食材项：`{name, qty:number|null, unit, kind:'main'|'seasoning', inventoryUid:string|null}`，`qty:null` = 适量。

```js
/** State：所有表反序列化后的数组 {users,sessions,recipes,inventory,orders,shopping,menu} */
/** Ctx：{now:ISO, rand:64-hex, tz:'Europe/Amsterdam', seq:number} */
/** Result：{status, body, writes:{[table]:row[]}, events:Event[]} */
/** Event：{type:'order.placed'|'order.accepted'|'order.rejected'|'order.done'|'stock.low'|'push.test'|'digest', to:string /*pushToken*/, ...字段} */
```

core 不拼推送文案，只产出带收件人 token 的事件；文案在「通知中心」工作流里用 Edit Fields 节点的表达式拼（画布上一眼可读）。没有 pushToken 的收件人不产出事件。

**动作表**（`POST /webhook/pk/api`，body `{action, token, payload}`；成功时 `data` 默认 `view(stateAfter, me)`）：

| action | 谁 | payload | 里程碑 |
|---|---|---|---|
| `auth.setup` / `auth.login` / `auth.logout` | 公开 | `{name,pin}` / `{name,pin}` / `{}` | M1 |
| `state.get` | 全部 | `{}` | M1 |
| `users.create` / `users.resetPin` | chef | `{name,pin}` / `{uid,pin}` | M1 |
| `me.update` / `me.testPush` | 全部 | `{pushToken?,avatar?}` / `{}` | M1 |
| `recipes.save` | chef 任意；diner 只新建 wish | `{recipe}` | M1 |
| `recipes.promote` / `recipes.archive` / `recipes.vote` | chef / chef / 全部 | `{uid}` | M1 |
| `orders.place` | 全部 | `{items:[recipeUid], servings, wantedDate, meal, wantedTime, note}` | M1 |
| `orders.cancel` / `accept` / `reject` / `done` | 下单人(pending) / chef | `{uid}` / `{uid}` / `{uid,reason}` / `{uid}` | M1 |
| `inventory.save` | chef | `{item}` | M1 |
| `shopping.add` / `check` / `uncheck` | chef | `{name,qty,unit}` / `{uid,boughtQty,expiresOn?}` / `{uid}` | M1 |
| `shopping.applyReceipt` | chef | `{lines:[{name,qty,unit,target:{shoppingUid?|inventoryUid?|create?|ignore?}}]}` | M3 |
| `menu.set` | chef | `{date, recipeUids}` | M4 |

AI 端点：`POST /webhook/pk/import` `{token, url?, text?, images?:[{base64, mediaType}]}` → `{ok, data:{draft}}`；`POST /webhook/pk/receipt` `{token, image:{base64, mediaType}}` → `{ok, data:{lines}}`。

`view(state, me, ctx)`：`{me:{uid,name,role,avatar,hasPush}, users:[{uid,name,role,avatar}], recipes, orders(diner 只含自己的), inventory(仅 chef), shopping(仅 chef), availability:{[recipeUid]:{makeable,missing:[name]}}, dishCounts:{[recipeUid]:n}}`；M4 追加 `menu, recommended, stats, badges, newBadges`。绝不含 `pinHash/pinSalt/pushToken/会话 token`。

---

## 文件结构

```
pixel-kitchen/
  package.json  .gitignore  README.md
  core/      schema ids time units sha256 auth view handle recipes stock shopping orders
             ai prompts receipt menu stats badges digest index  (+ *.test.js)
  n8n/       build.mjs  build.test.js  config.test.json  config.prod.json
             lib/{nodes.mjs,layout.mjs}
             workflows/{auth,api,notify,setup,import,receipt,digest}.mjs
             runtime/package.json
  deploy/    docker-compose.yml  Caddyfile  .env.example
  scripts/   n8n-env.sh  deploy-local.sh  set-anthropic-key.sh  server.sh  backup-pull.sh
  tests/e2e/ harness.mjs  mock-upstream.mjs  api.e2e.test.js  import.e2e.test.js  receipt.e2e.test.js  digest.e2e.test.js
  web/       package.json vite.config.js index.html public/fonts/ scripts/charset.txt
             src/{main.jsx,app.jsx,api.js,store.js,copy.js,theme.css}
             src/ui/  src/pages/  src/lib/image.js
  .github/workflows/pages.yml
  docs/portfolio/  （M4：工作流截图、架构图）
```

---

# M1 · 点菜闭环

### Task 1: 仓库骨架 + schema + ids/time/units

**Files:** Create `package.json`, `.gitignore`, `core/{schema,ids,time,units}.js` + tests

**Interfaces — Produces:**
- `TABLES`；`serialize(table,row)`（丢未知键、json→string、缺省 ''/0/false）；`deserialize(table,raw)`（丢 `id/createdAt/updatedAt`，json 解析失败给 `[]`，无 uid → null）；`stateFromTables({pk_users:[...],...}) -> State`
- `newId(ctx, prefix)` = `${prefix}_` + `Date.parse(ctx.now).toString(36)` + `ctx.rand.slice(k*6,k*6+6)`，`k=ctx.seq++`
- `localDate(iso,tz)`、`localTime(iso,tz)->'HH:MM'`、`daysUntil(date,today)`
- `normalizeUnit(u)`：kg/公斤→g×1000、克/g→g、斤→g×500、两→g×50、L/升→ml×1000、毫升/ml→ml、个/只/颗/枚/根→个、汤匙/大勺→ml×15、茶匙/小勺→ml×5，其余原样；`convert(qty,from,to)->number|null`；`round1(n)`

- [ ] **Step 1:** `git init`；`.gitignore`；根 `package.json`：`"type":"module"`、`"engines":{"node":">=24"}`、`"test":"node --test core/ n8n/"`。
- [ ] **Step 2: 失败测试**

```js
assert.equal(convert(1,'斤','g'), 500); assert.equal(convert(1.5,'kg','克'), 1500);
assert.equal(convert(2,'大勺','ml'), 30); assert.equal(convert(2,'个','g'), null);
assert.equal(localDate('2026-10-22T23:30:00Z','Europe/Amsterdam'), '2026-10-23');
assert.equal(daysUntil('2026-10-25','2026-10-22'), 3);
const raw = serialize('pk_recipes',{uid:'r1',name:'红烧肉',ingredients:[{name:'五花肉',qty:500,unit:'g'}],junk:1});
assert.equal(typeof raw.ingredients,'string'); assert.ok(!('junk' in raw));
assert.equal(deserialize('pk_recipes',{...raw,id:7,createdAt:'x'}).ingredients[0].qty, 500);
assert.equal(deserialize('pk_users',{}), null);
const ctx={now:'2026-10-22T10:00:00Z',rand:'ab'.repeat(32),seq:0}; assert.notEqual(newId(ctx,'o'),newId(ctx,'o'));
```

- [ ] **Step 3:** `npm test` → FAIL　**Step 4:** 实现（`Intl.DateTimeFormat('en-CA',{timeZone})`）　**Step 5:** PASS
- [ ] **Step 6:** `git commit -m "feat(core): schema, ids, time, units"`

### Task 2: sha256 + 认证 + 分发器 + view

**Files:** Create `core/{sha256,auth,view,handle,index}.js` + tests

**Interfaces:**
- Consumes: Task 1
- Produces: `sha256Hex(str)`；`hashPin(pin,salt)=sha256Hex(salt+':'+pin)`；`authenticate(state,token,nowIso)->User|null`；`handle(action,state,payload,ctx)->Result`（注册表 `ACTIONS[action]={role:'public'|'any'|'chef', run(state,payload,ctx,me)->{writes,events?,data?}}`，动作内 `throw fail(code,msg)`，handle 映射状态码、未知 action → BAD_INPUT、默认 data=view(applyWrites(...))）；`applyWrites(state,writes)`；`view(state,me,ctx)`（M1 字段）；动作 `auth.*`、`state.get`、`users.*`、`me.update`、`me.testPush`（产出 `push.test` 事件）；`core/index.js` 汇总导出
- 盐 = `ctx.rand.slice(0,16)`；会话 token = `ctx.rand`；登录失败的响应同样带 writes（failedLogins/lockedUntilIso）

- [ ] **Step 1: 失败测试**

```js
test('sha256 vector', ()=>assert.equal(sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
test('setup only when no users')          // 第一次 200 role chef 带 token；第二次 403
test('login with empty user table')       // 404 NO_USERS
test('login ok returns 30-day session')
test('lockout after five failures')       // 第 6 次正确口令也 423；15 分钟后可登录且 failedLogins 归零
test('pin must be 4 digits')              // '12a4' → 400
test('diner cannot users.create')         // 403
test('unauthenticated state.get')         // 401
test('view hides secrets')                // 序列化后不含 pinHash/pinSalt/pushToken 值/任何会话 token
test('diner view excludes inventory, shopping, others orders')
test('testPush without token')            // 400，message 含 'PushPlus'
test('testPush emits event to self')      // events[0] {type:'push.test', to: me.pushToken}
```

- [ ] **Step 2–4:** FAIL → 实现 → PASS
- [ ] **Step 5:** `git commit -m "feat(core): auth, dispatcher, view"`

### Task 3: 菜谱（两区、草稿规范化、食材匹配）

**Files:** Create `core/recipes.js` + test

**Interfaces — Produces:**
- `matchIngredient(name, inventory) -> Item|null`：精确名 → aliases → 去修饰词（新鲜/切片/去皮/适量/少许）后比较
- `normalizeDraft(aiRecipe, inventory) -> Draft`：食材补 `inventoryUid`、`unmatched`；单位 `normalizeUnit`，能换算成库存单位就换；`baseServings` 缺省 2；`qty<=0` → null
- 动作 `recipes.save/promote/archive/vote`

- [ ] **Step 1: 失败测试**：`match by alias`（库存 番茄 aliases[西红柿]）、`normalizeDraft converts 1斤 to 500 g when stock in g`、`keeps 适量 as null and marks unmatched`、`diner can only create wish`（diner 存 signature → 结果 wish；改已有 → 403）、`promote moves wish to signature`、`vote toggles`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat(core): recipes"`

### Task 4: 库存与采购

**Files:** Create `core/stock.js`, `core/shopping.js` + tests

**Interfaces:**
- Consumes: Task 3 `matchIngredient`；Task 1 `convert/newId`
- Produces: `available(item,state,exceptOrderUid?)`（qty − 其他 pending/accepted 订单 needs）；`addShoppingReason(state,ctx,{name,inventoryUid,qty,unit,reason})->Shop`（同 inventoryUid/同名未完成项合并）；`removeOrderReason(shop,orderUid)->Shop`（无原因且 qty≤0 → removed）；`lowStockCheck(item)`（main：qty≤lowThreshold；seasoning：status≠'ok'）；`stockIn(state,ctx,{inventoryUid?|name, qty, unit, expiresOn?})->Item`（换算，换不了 400；无库存项则新建 main）；动作 `inventory.save`、`shopping.add/check/uncheck`

- [ ] **Step 1: 失败测试**：`shopping merges same item`、`check adds stock with conversion`（库存 g，买 1 斤 +500）、`check creates inventory when none`、`uncheck reverses`、`available subtracts open orders`（600g，另单需 500g → 100）、`seasoning check resets status ok`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat(core): inventory and shopping"`

### Task 5: 订单生命周期 + 可做性 + 次数

**Files:** Create `core/orders.js` + test；Modify `core/view.js`

**Interfaces:**
- Consumes: Task 3、Task 4
- Produces:
  - `computeNeeds(recipes,servings,inventory)->Need[]`（`qty×servings/baseServings`，换算到库存单位，同 inventoryUid 合并；换不了 → `unitMismatch:true, qty:null`）
  - `computeShortages(needs,state,orderUid)->[{name,inventoryUid,qty,unit,reason:'short'|'missing'|'out'|'unitMismatch'}]`
  - 动作 `orders.place`（items 全为未归档 signature；servings 1–20；`wantedDate ≥ 今天`、`meal` 枚举、`wantedTime` 空或 `HH:MM`；可买的缺料进采购 `{type:'order',orderUid,qty}`；事件 `order.placed` 给厨师，含 `who, dishes, servings, wantedDate, meal, wantedTime, note, shortages`）、`orders.cancel/accept/reject`（cancel/reject 调 `removeOrderReason`；事件 `order.accepted/rejected` 给下单人）、`orders.done`（`qty=max(0,round1(qty−need))`，unitMismatch/null 不扣；扣后 `lowStockCheck` 且无未完成采购项 → 加 `low` 原因 + 事件 `stock.low` 给厨师；事件 `order.done` 给下单人）
  - 状态机：pending→accepted|rejected|cancelled；accepted→done|rejected；其余 409
  - `availability(state)`、`dishCounts(state)`（只算 done 订单，每个 item +1）加入 view

- [ ] **Step 1: 失败测试**

```js
test('scale needs by servings')                 // base 2 需 500g，3 人 → 750g
test('shortage goes to shopping')               // 库存 200g → 缺 550，采购 550
test('unit mismatch is flagged not deducted')
test('place rejects wish recipe')               // 400
test('place rejects past date and bad meal')    // 400
test('placed event to chef')                    // events[0].to===chef.pushToken，dishes 含'红烧肉'，servings 3
test('cancel unwinds shopping')                 // removed===true
test('reject keeps other reasons')              // 同时有 low → 只剩 low
test('done deducts and emits stock.low')        // 800 阈值 100 需 750 → 50，采购出现 low，events 含 stock.low
test('done is idempotent')                      // 第二次 409，库存只扣一次
test('accept cancelled order conflicts')        // 409
test('only owner cancels pending')              // 他人 403；accepted 后本人 409
test('no event when no push token')
test('availability lists missing names')        // 缺小葱 → missing:['小葱']
test('dishCounts only done')
```

- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat(core): order lifecycle"`

### Task 6: n8n 生成器 + 登录校验子流程 + 点餐接口 + 通知中心 + 建表 + 本地 e2e

**Files:** Create `n8n/lib/{nodes,layout}.mjs`, `n8n/build.mjs`, `n8n/config.{test,prod}.json`, `n8n/workflows/{auth,api,notify,setup}.mjs`, `n8n/build.test.js`, `n8n/runtime/package.json`, `scripts/{n8n-env.sh,deploy-local.sh,set-anthropic-key.sh}`, `tests/e2e/{harness.mjs,mock-upstream.mjs,api.e2e.test.js}`；Modify 根 `package.json`（devDep esbuild；`build:n8n`、`test:e2e`）

**Interfaces:**
- Consumes: `core/index.js`
- Produces:
  - `config.*.json`：`{allowedOrigins, anthropicUrl, pushplusUrl, timezone, anthropicCredentialId:'pkAnthropicCred1'}`；test：URL 指 `http://127.0.0.1:5690/anthropic/v1/messages`、`http://127.0.0.1:5690/pushplus/send`，origins `*`；prod：origins `https://<GitHub用户名>.github.io`（执行时问用户），URL 用真实地址
  - `nodes.mjs`（参数名以 `n8n/runtime/node_modules/n8n-nodes-base/dist/node-definitions/nodes/n8n-nodes-base/<node>/v*.ts` 为准）：`webhook(path)`（v2.2，POST，responseMode responseNode，`options.allowedOrigins`）、`execTrigger(inputs)`、`execWorkflow(id,{wait})`、`cryptoRand()`（v2 generate hex 64 → `rand`）、`dtGetAll(table)`（v1.1 row get，`dataTableId:{mode:'name',value}`，returnAll，`executeOnce`，`alwaysOutputData`）、`dtUpsert(table)`（条件 `uid eq ={{$json.uid}}`，`columns.mappingMode:'autoMapInputData'`）、`dtCreate(table,columns)`（`options.createIfNotExists:true`）、`code(name, body, {withCore})`（v2 runOnceForAllItems；只有 `withCore:true` 才内联 bundle）、`http(name,…)`、`ifNode`、`switchNode`、`setFields(name, assignments)`、`respond(fromNode?)`（v1.5 json，body/状态码来自 `fromNode` 或当前 `$json`）、`sticky(text, box)`
  - `layout.mjs`：`place(nodes, grid)` 按 `{col,row}` 给 position（列距 260、行距 160）
  - `build.mjs --env test|prod` → `n8n/dist/*.json`；esbuild 打 `core/index.js` 为 IIFE（`globalName:'PK'`，`target:'node20'`）
  - **工作流**（id 固定，重复导入即覆盖）：
    - `pkAuth0000000001`「登录校验」（子流程）：触发(token) → 读 pk_sessions → 读 pk_users → 「核对会话」(Code, withCore：`PK.authenticate`) → 输出 `{ok, me|error}`
    - `pkApi00000000001`「点餐接口」：Webhook `pk/api` → 生成随机数 → IF「登录/建号类？」→ 否 → 执行「登录校验」→ IF「通过？」否 → Respond 401 → 是/登录类 → 读 7 张表（串联）→ 「业务处理」(Code, withCore：`PK.handle`，输出 `{status, body, writes(已 serialize), events}`) → 从「业务处理」分出支路，**画布 y 从上到下**：7 条「挑出 pk_x 的改动」(Code, 无 core) → 「写入 pk_x」；「有通知？」IF → 执行「通知中心」（不等待）；最下方 Respond(fromNode 业务处理)
    - `pkNotify00000001`「通知中心」：触发(events) → Switch「事件类型」6 路（新订单 / 已接单 / 被拒单 / 出锅了 / 快用完了 / 测试推送；digest 在 M4 加第 7 路）→ 每路 Edit Fields 拼 `title/content`（文案见下）→ 汇合 → 「发到微信」PushPlus
    - `pkSetup00000001`「建表」：手动触发 → 7 个 dtCreate
    - 每个工作流带便签；webhook 工作流 settings 见 Global Constraints
  - 推送文案（Edit Fields 表达式）：新订单 `🍳 {who} 点菜啦` / `{dishes 用、连接}｜{servings}人｜{wantedDate} {餐次中文}{wantedTime}｜备注：{note}｜缺：{shortages 名}`；已接单 `厨师接单啦` / `{dishes}`；被拒单 `这单做不了` / `{reason}`；出锅了 `{dishes} 出锅啦` / `快来吃！`；快用完了 `{name} 快用完了` / `已加入采购清单`；测试推送 `乡村小厨` / `推送设置成功 ✦`
  - `n8n-env.sh`：`N8N_USER_FOLDER`（e2e `$REPO/.n8n-test`）、`N8N_PORT=5679`、Global Constraints 中全部 n8n 环境变量、`N8N_SECURE_COOKIE=false`、`N8N_BIN=$REPO/n8n/runtime/node_modules/.bin/n8n`
  - `deploy-local.sh`：build test → `import:workflow --separate --input=n8n/dist` → `publish:workflow --all` → `execute --id=pkSetup00000001`（n8n 未运行时执行）
  - `set-anthropic-key.sh [--test] [--docker]`：`read -s` 读 key（用户自己粘贴）→ 临时 JSON `[{id:'pkAnthropicCred1',name:'Anthropic API',type:'httpHeaderAuth',data:{name:'x-api-key',value}}]` → `import:credentials` → 删临时文件；`--test` 用假 key；`--docker` 把 JSON 经 ssh 标准输入交给服务器容器导入（见 Task 7）
  - `mock-upstream.mjs`（5690）：`/pushplus/send` 记录，`GET /pushplus/log` 返回；Anthropic 模拟在 Task 12 补
  - `harness.mjs`：删 `.n8n-test` → set key --test → deploy-local → 后台起 n8n → 轮询 `/healthz` ≤ 90s → 导出 `api(action,payload,token)`

- [ ] **Step 1:** `n8n/runtime` 里 `npm install`（n8n@2.44.6，后台跑）。
- [ ] **Step 2: 失败测试**

```js
// n8n/build.test.js
test('api writes every table')            // 7 get + 7 upsert，表名覆盖 TABLES
test('respond is bottom-most branch')
test('core inlined only where needed')    // 含 'var PK' 的节点只有 核对会话、业务处理
test('every workflow has a sticky note and chinese names')
test('webhook workflows do not save success data')
test('no secrets in dist')                // 不含 'sk-ant'
// tests/e2e/api.e2e.test.js
test('setup → login → create diner')
test('diner orders, chef gets push')      // /pushplus/log 一条，content 含菜名与'3人'
test('done deducts stock persisted')      // 再 state.get 库存已变
test('concurrent writes both land')       // 同时发 shopping.check 与 orders.place，之后两者都可见
test('CORS preflight allowed')
test('bad token is 401')
```

- [ ] **Step 3:** FAIL　**Step 4:** 实现；参数与 node-definitions 不符时以其为准并同步改测试　**Step 5:** `npm test && npm run test:e2e` PASS
- [ ] **Step 6:** 本地起 n8n，浏览器面板打开编辑器，截图检查 4 个工作流排版清楚、中文命名、有便签；不清楚就调整 layout。
- [ ] **Step 7:** `git commit -m "feat(n8n): auth, api, notify, setup workflows with e2e"`

### Task 7: 云服务器（Docker + Caddy + 部署 + 备份）

**Files:** Create `deploy/{docker-compose.yml,Caddyfile,.env.example}`, `scripts/{server.sh,backup-pull.sh}`

**Interfaces — Produces:**
- `docker-compose.yml`：`n8n`（`n8nio/n8n:2.44.6`，`env_file: .env`，卷 `./n8n-data:/home/node/.n8n`、`./workflows:/workflows:ro`，`ports: ["127.0.0.1:5678:5678"]`，`restart: unless-stopped`）；`caddy`（`caddy:2`，80/443，卷 Caddyfile、caddy-data）
- `Caddyfile`：`{$PK_DOMAIN} { handle /webhook/pk/* { reverse_proxy n8n:5678 } handle { respond 404 } }`
- `.env.example`：Global Constraints 中全部 n8n 环境变量 + `PK_DOMAIN` + `WEBHOOK_URL=https://${PK_DOMAIN}/`
- `server.sh <cmd>`（读 `deploy/.env` 里的 `PK_HOST`）：`provision`（ssh：装 Docker 官方包、ufw 只开 22/80/443、`sqlite3`、建 `/opt/pixel-kitchen`、写备份 cron）、`deploy`（build prod → rsync `deploy/` 和 `n8n/dist/` → `docker compose stop n8n` → `docker compose run --rm n8n import:workflow --separate --input=/workflows` → `publish:workflow --all` → `execute --id=pkSetup00000001` → `up -d`）、`set-key`（调用 `set-anthropic-key.sh --docker`：在用户本机终端 `read -s` 读 key，经 ssh 标准输入传给 `docker compose exec -T n8n sh -c 'cat > /tmp/c.json && n8n import:credentials --input=/tmp/c.json; rm -f /tmp/c.json'`）、`editor`（`ssh -N -L 5678:127.0.0.1:5678`）、`logs`
- 备份：服务器 cron `0 4 * * *` → `sqlite3 n8n-data/database.sqlite ".backup backups/pk-$(date +%F).sqlite"`，保留 14 份；`backup-pull.sh` rsync 到 `~/Library/Mobile Documents/com~apple~CloudDocs/乡村小厨备份/`

- [ ] **Step 1:** 请用户购买 VPS（建议 Hetzner 最低档，欧洲机房，Ubuntu 24.04），创建时添加 Mac 的 SSH 公钥（没有就先 `ssh-keygen -t ed25519`）；用户把 IP 告诉助手。安装 Docker 前向用户说明会从 Docker 官方源安装。
- [ ] **Step 2:** `server.sh provision`；`PK_DOMAIN=<ip短横线>.sslip.io`。
- [ ] **Step 3:** `server.sh deploy`；验证 `curl -s -o /dev/null -w '%{http_code}' https://$PK_DOMAIN/` 为 404，`curl -X POST https://$PK_DOMAIN/webhook/pk/api -d '{"action":"state.get"}' -H 'content-type: application/json'` 返回 401 JSON，证书有效。
- [ ] **Step 4:** 用户运行 `server.sh set-key` 粘贴 Anthropic key（若还没买，见 Task 18 README 步骤，可推迟到 M2 前）。
- [ ] **Step 5:** 手动跑一次备份 cron 命令，确认生成文件；`backup-pull.sh` 拉到 iCloud 成功。
- [ ] **Step 6:** `git commit -m "feat(ops): docker, caddy, server scripts, backups"`

### Task 8: 前端骨架（主题、像素组件、字体、API、登录、路由）

**Files:** Create `web/` 基础文件、`web/src/ui/{PixelBox,Button,Sprite,sprites,TabBar,Sheet,Toast,Offline,PinPad,PixelPhoto}.jsx|js`、`web/src/pages/{Login,Setup}.jsx`、`web/public/fonts/*`、`web/scripts/charset.txt` + tests

**Interfaces — Produces:**
- `getApiBase()`：`import.meta.env.VITE_API_BASE`；开发时可被 `?api=` 覆盖（存 localStorage 并从地址栏去掉）
- `call(action,payload)`（网络失败抛 `OfflineError`；`{ok:false}` 抛 `ApiError{code,message}`；401 清 token 回登录）、`postAi('import'|'receipt', body)`
- `useApp() -> {view, token, me, refresh(), act(action,payload)}`
- `sprites.js`：至少 `pot bowl tomato hat cart basket fridge star cat leaf egg fish`（复用样稿渲染器）
- hash 路由 `#/order #/recipes #/recipe/:uid #/import #/shopping #/inventory #/me`；TabBar：diner 点菜/菜谱/我的，chef 点菜/菜谱/采购/食材库/我的
- `Login`（名字 + `PinPad` 像素数字键盘；`NO_USERS` → `Setup`）；`Offline`（像素猫 +「厨房打烊了」+「服务器连不上，稍后再试」+ 重试）

- [ ] **Step 1:** 下载 Fusion Pixel 12px 简体 woff2（**先征得用户同意**）；`uv tool run --from fonttools pyftsubset … --flavor=woff2 --text-file=web/scripts/charset.txt`。
- [ ] **Step 2: 失败测试**：`api base override in dev`、`offline screen on network error`、`chef sees five tabs, diner three`、`401 returns to login`、`pin pad emits 4 digits then submits`。
- [ ] **Step 3–5:** FAIL → 实现 → PASS（`cd web && npx vitest run`）
- [ ] **Step 6:** `.claude/launch.json` 配 `web-dev`（`npm --prefix web run dev`，5173，`VITE_API_BASE` 指本地 e2e n8n）；浏览器面板对照样稿 A 截图。
- [ ] **Step 7:** `git commit -m "feat(web): shell, theme, auth"`

### Task 9: 点菜页 + 厨师待处理订单 + 推送设置

**Files:** Create `web/src/pages/{Order,ChefQueue,PushSetup}.jsx`, `web/src/ui/{DishCard,Checkout}.jsx` + tests

**Interfaces — Produces:**
- 版式照样稿 A：格子棚 → 标题栏「乡村小厨 / 今日 · 10月22日 周四」→ 菜品列表（按 dishCounts 降序，「点过 N 次」，`availability.missing` →「缺：xx」）→ 底栏；今日 menu 卡片行在 M4 加
- 购物车 localStorage `pk.cart`；`Checkout` 弹层：人数 1–20（默认 2）、日期（今天/明天/后天/选日期）、餐次三选一（午饭/晚饭/夜宵，默认按当前时间：<14 点午饭，<21 点晚饭，否则夜宵）、可选时间点、备注 → `orders.place`
- 厨师：页首「待处理订单」按 `wantedDate+meal` 分组；pending 接单/拒单（原因预设「缺料」「今天没空」+ 自填）；accepted「做好了」
- `PushSetup`（M1 就要，因为 M1 验收要收推送）：三步教程（关注 PushPlus 公众号 → 复制 token → 粘贴）+「发一条试试」(`me.testPush`)；从「我的」临时入口进入（我的页完整版在 Task 17）

- [ ] **Step 1: 失败测试**：`cart survives reload`、`checkout sends structured time`（payload 含 wantedDate/meal/wantedTime）、`default meal by hour`、`wish recipes not orderable`、`chef queue groups by meal`、`chef reject requires reason`、`test push button calls me.testPush`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** 浏览器面板 375×812 截图
- [ ] **Step 6:** `git commit -m "feat(web): order page, chef queue, push setup"`

### Task 10: M1 上线与真机验收

**Files:** Create `.github/workflows/pages.yml`；Modify `web/vite.config.js`（`base:'/pixel-kitchen/'`）、`n8n/config.prod.json`

- [ ] **Step 1:** 问用户 GitHub 用户名，确认新建公开仓库 `pixel-kitchen` 并推送（对外操作，先确认）；仓库变量 `VITE_API_BASE=https://<PK_DOMAIN>`。
- [ ] **Step 2:** `pages.yml`：push main → web `npm ci && npm run build` → `actions/deploy-pages`。
- [ ] **Step 3:** `server.sh deploy`（prod origins 已填 GitHub Pages 域名）。
- [ ] **Step 4:** 用户在微信里打开 Pages 链接：建厨师账号 → 厨师设置 PushPlus 并「发一条试试」→ 厨师建一道拿手菜（手动录入）和库存 → 用户建账号下单 → 厨师微信收到 → 接单 → 做好了 → 库存变化。逐项记录：微信是否拦截页面、字体是否正常、推送是否到达（PushPlus 若要求实名或额度不够，在这里停下与用户商量换 Server酱）。
- [ ] **Step 5:** 修完验收中发现的问题；`git commit -m "chore: M1 release"`；**M1 门槛**：用户确认通过后才开始 M2。

# M2 · 菜谱导入

### Task 11: AI 请求构造与解析（多图）

**Files:** Create `core/ai.js`, `core/prompts.js` + test

**Interfaces — Produces:**
- `RECIPE_SCHEMA`、`RECEIPT_SCHEMA`（`additionalProperties:false`、全 required；菜谱 `{isRecipe, name, baseServings, ingredients:[{name,qty:number|null,unit,kind}], steps, tags, imageUrl}`；小票 `{lines:[{rawName,name,qty,unit}]}`）
- `classifySource({url?, text?}) -> 'xhs'|'douyin'|'web'|'text'`（域名含 xiaohongshu/xhslink → xhs；douyin/iesdouyin → douyin）；`findUrl(text)`
- `extractPageText(html,url)->{text,imageUrl}`（og 标签、ld+json Recipe、去标签正文，截 12000 字）
- `buildRecipeRequest({text?, images?:[{base64,mediaType}], inventoryNames})`：images 最多 6，图片块在文本前；`buildReceiptRequest({image, inventoryNames})`；提示词在 `prompts.js`（中文；食材名尽量用 inventoryNames；多图合并成一份；荷兰语商品译中文）
- `parseClaudeJson(resp) -> {ok,value}|{ok:false,code:'UPSTREAM'|'NEEDS_FALLBACK',message}`

- [ ] **Step 1: 失败测试**：`request shape`（model、effort low、json_schema、无 temperature/top_p/top_k、图片在文本前）、`at most six images`（7 张 → 抛 BAD_INPUT）、`classify xhs share text`、`findUrl from share text`、`extract ld+json recipe`、`refusal yields error`、`not a recipe asks fallback`、`thinking blocks are skipped`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat(core): claude builders, multi-image"`

### Task 12: 「导入菜谱」工作流

**Files:** Create `n8n/workflows/import.mjs`, `tests/e2e/import.e2e.test.js`；Modify `tests/e2e/mock-upstream.mjs`, `n8n/build.test.js`

**Interfaces — Produces:**
- `pkImport00000001`「导入菜谱」：Webhook `pk/import` → 执行「登录校验」→ IF 通过（否 → Respond 401）→ 读食材库 → 「判断来源」(Code, withCore：`classifySource`) → Switch 四路：
  - 「有截图」→「看图识别」
  - 「普通网页」→「抓网页」(HTTP GET，iPhone Safari UA，`onError continueRegularOutput`) →「提取正文」(Code, withCore；正文 < 80 字 → NEEDS_FALLBACK)
  - 「小红书/抖音且没截图」→ Respond 422 NEEDS_IMAGES：「小红书和抖音的菜谱请截图上传（最多 6 张），分享文案也一起粘贴更准。抖音视频菜谱可能识别不了。」
  - 「纯文字」→ 直接构造请求
  → 「Claude 拆菜谱」(HTTP POST，凭据 `pkAnthropicCred1`，头 `anthropic-version: 2026-10-21`) →「整理草稿」(Code, withCore：parse + normalizeDraft) → Respond
- mock：`/anthropic/v1/messages` 按是否含 image 块 / 文本含 `NO_RECIPE` 返回预置结果；`/page/plain-recipe` 返回带 ld+json 的页面；`/page/empty` 返回空页面

- [ ] **Step 1: 失败 e2e**：`import web page returns draft`、`import screenshots returns draft`、`xhs link without images asks for screenshots`（422 NEEDS_IMAGES）、`empty page asks fallback`、`not logged in is 401`；build 测试：`import has sticky and chinese names`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS
- [ ] **Step 5:** 浏览器面板截图检查画布排版。
- [ ] **Step 6:** `git commit -m "feat(n8n): import workflow"`

### Task 13: 菜谱页 + 导入界面 + M2 验收

**Files:** Create `web/src/pages/{Recipes,RecipeDetail,Import,DraftEditor}.jsx`, `web/src/lib/image.js` + tests

**Interfaces — Produces:**
- `Recipes`：两页签「拿手菜」「想吃清单」；想吃 +N（`recipes.vote`）；厨师「学会了 → 升级」
- `RecipeDetail`：份数调节（`qty×n/baseServings`，适量原样，用 `core/units.js`）、步骤、来源；`PixelPhoto`（画到 32px 宽 canvas 再 `image-rendering:pixelated` 放大，`referrerpolicy="no-referrer"`，无图用像素锅）
- `Import`：一个表单——粘贴链接或分享文案 + 选图（`<input type=file accept="image/*" multiple>`，最多 6 张，缩略图可删）；输入里检测到小红书/抖音链接且没选图时，表单内直接提示去截图（不必等服务器 422）；`downscaleToJpegBase64(file, maxEdge=1568, quality=0.85)`，纯计算 `fitWithin(w,h,max)` 单独导出；等待时像素锅冒泡动画
- `DraftEditor`：可改菜名/份数/食材/步骤；`unmatched` 标黄「库存里没有，买回来会新建」；diner 只能存想吃清单

- [ ] **Step 1: 失败测试**：`scales quantities for 4 servings`、`xhs link prompts screenshots before submit`、`max six images`、`fitWithin keeps aspect`、`diner save forces wish`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS
- [ ] **Step 5:** `server.sh deploy`；push 触发 Pages。用户真机验收：下厨房链接导入、小红书截图（多张）导入、存进想吃清单、厨师升级为拿手菜后可点。**M2 门槛**。
- [ ] **Step 6:** `git commit -m "feat(web): recipes and import"`

# M3 · 库存、采购、小票

### Task 14: 小票识别（core + 工作流）

**Files:** Create `core/receipt.js` + test、`n8n/workflows/receipt.mjs`、`tests/e2e/receipt.e2e.test.js`

**Interfaces — Produces:**
- `matchReceipt(lines,state)`：每行加 `suggestion: {shoppingUid}|{inventoryUid}|{create:true}`（先未完成采购项，再库存，均用 `matchIngredient`）
- 动作 `shopping.applyReceipt`（逐行：shoppingUid → 等同 check；inventoryUid → `stockIn`；create → 新建；ignore 跳过）
- `pkReceipt0000001`「小票入库」：Webhook `pk/receipt` → 登录校验 → IF「是厨师？」(否 → 403) → 读食材库 → 读采购清单 →「Claude 看小票」→「对上采购清单」(Code, withCore) → Respond；带便签

- [ ] **Step 1: 失败测试**：core `suggestion prefers open shopping item`、`applyReceipt ignore leaves state unchanged`、`applyReceipt create makes item`；e2e `receipt requires chef`、`receipt returns suggestions`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat: receipt scanning"`

### Task 15: 采购页 + 食材库页 + 小票界面 + M3 验收

**Files:** Create `web/src/pages/{Shopping,ReceiptScan,Inventory}.jsx` + tests

**Interfaces — Produces:**
- `Shopping`：未买/已买两段；勾选弹数量框（默认 qty，单位可选，可填保质期）→ `shopping.check`；已买项「撤销」→ `shopping.uncheck`；原因小字（「红烧肉那单缺」「快用完了」「手动添加」）；手动添加
- `ReceiptScan`：拍照 → 逐行（荷兰语原名小字 + 中文名 + 数量 + 去向下拉）→ `shopping.applyReceipt`
- `Inventory`：主料/调料分组；主料数量+单位+阈值+保质期（≤3 天标红「快过期」）；调料三态 有/快没了/没了；新建/编辑弹层

- [ ] **Step 1: 失败测试**：`check opens qty dialog with default`、`uncheck available on done items`、`receipt ignore excluded from payload`、`expiring badge within 3 days`、`seasoning status cycles`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS
- [ ] **Step 5:** 部署；用户真机：拍一张 Albert Heijn 小票入库、勾采购入库、改调料状态。**M3 门槛**。
- [ ] **Step 6:** `git commit -m "feat(web): shopping, receipt, inventory"`

# M4 · 每日 menu、游戏化、早报、作品集

### Task 16: menu/推荐/统计/徽章（core）+「每日早报」工作流

**Files:** Create `core/{menu,stats,badges,digest}.js` + tests、`n8n/workflows/digest.mjs`、`tests/e2e/digest.e2e.test.js`；Modify `core/view.js`、`core/orders.js`、`n8n/workflows/notify.mjs`

**Interfaces — Produces:**
- `recommend(state,today)->recipeUid[]`（≤3）：候选 = 未归档 signature 且可做（main 食材 `available ≥ need`（按 baseServings）、无 seasoning out、无 unitMismatch）；得分 = Σ 临期食材 `(4−daysUntil)`（0≤days≤3）+（7 天内没做过 ? 1 : 0）；同分按名字
- 动作 `menu.set`；`todayMenu(state,today)->{date,recipeUids,source:'chef'|'auto'}`
- `leaderboard(state)`（每人前 5）；`chefStats(state,today)->{top, stale(30天), favorites}`
- `BADGES`（8 个，`{id,title,desc,test(state,userUid)}`）：`regular:<recipeUid>`「{菜名}老顾客」同一道 10 次；`taster5`「小馋猫」5 道不同；`taster20`「尝遍二十味」；`firstBite`「第一口」某菜第一次做好的那单是你的；`wishGranted`「心想事成」你加入想吃的菜被做好；`sevenDays`「七天饭搭子」7 个不同日期吃到；`nightOwl`「夜宵达人」3 单 `meal==='late'` 或 `wantedTime ≥ '21:00'`；`chef100`「掌勺一百道」（厨师）
- `orders.done` 返回 `newBadges`（下单人 done 前后差集）
- `morningDigest(state,ctx)->Event[]`：`digest` 事件给每个有 pushToken 的人（今日 menu 菜名）；厨师的额外带 `expiring:[{name,days}]`
- view 追加 `menu, recommended, stats(leaderboard; chef 才有 chef), badges, newBadges`
- `pkDigest00000001`「每日早报」：Schedule `0 9 * * *` → 读 7 张表 →「生成今日菜单」(Code, withCore) → 执行「通知中心」；通知中心 Switch 加第 7 路「早报」：`今日 menu` / `{dishes}{厨师：快过期 xx(n天)}`

- [ ] **Step 1: 失败测试**：`recommend prefers expiring ingredients`、`recommend skips unmakeable`、`chef menu overrides auto`、`leaderboard top5 sorted`、`regular badge at 10 only once`、`night owl counts late meal`、`stale dishes after 30 days`、`digest expiring only for chef`；e2e `digest workflow pushes everyone with token`（手动执行该工作流，mock 收到 N 条）。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat: menu, badges, stats, digest"`

### Task 17: 我的页 + 点菜页补齐（menu、徽章、排行、统计、成员）

**Files:** Create `web/src/pages/{Me,Stats,Users,MenuPlanner}.jsx`；Modify `web/src/pages/Order.jsx`, `DishCard.jsx` + tests

**Interfaces — Produces:**
- 点菜页加：今日 menu 卡片行（auto 时角标「推荐」）、「★ 本周最爱」（近 7 天 done 次数第一）、`newBadges` Toast「✦ 解锁徽章「xx」」；厨师「排今天的菜」→ `MenuPlanner`（勾拿手菜 / 一键采纳推荐 → `menu.set`）
- `Me`：推送设置（复用 PushSetup）、我的订单（状态徽标 待接单/做菜中/出锅啦/没做成/已取消；pending 可取消）、徽章墙（已解锁彩色、未解锁灰色剪影 + 条件）、排行榜、退出
- 厨师：`Stats`（最受欢迎 / 30 天没人点 / 每人最爱）、`Users`（添加成员、重置口令）

- [ ] **Step 1: 失败测试**：`auto menu shows 推荐`、`badge toast shows on newBadges`、`pending order cancellable`、`locked badges greyed`、`chef sees stats and users, diner does not`、`menu planner adopts recommendations`。
- [ ] **Step 2–4:** FAIL → 实现 → PASS　**Step 5:** `git commit -m "feat(web): me page, badges, menu planner"`

### Task 18: 说明书 + 作品集材料 + 最终验收

**Files:** Create `README.md`, `docs/portfolio/{architecture.svg, *.png, README.md}`

- [ ] **Step 1:** `README.md`（中文）：①注册 Anthropic、充值 5 美元、建 API key、`server.sh set-key`（费用：Haiku 5.5 输入 $0.10 / 输出 $0.50 每百万 token，导入一份菜谱约几厘钱）；②PushPlus 关注与 token；③`server.sh deploy` / `editor` / `logs`；④备份与恢复（`backup-pull.sh`；恢复 = 停 n8n、替换 database.sqlite、启动）；⑤iPhone 加桌面要先在 Safari 打开；⑥在 n8n 编辑器里改的流程，下次部署会被代码覆盖。
- [ ] **Step 2:** `server.sh editor` 打开编辑器，浏览器面板截 7 个工作流（1600 宽，隐藏侧栏）存 `docs/portfolio/`。
- [ ] **Step 3:** 画架构图 `architecture.svg`：微信网页 → Caddy → n8n（点餐接口 / 登录校验 / 通知中心 / 导入菜谱 / 小票入库 / 每日早报）→ Data Tables；n8n → Claude、PushPlus。`docs/portfolio/README.md` 写一段项目说明（问题 → 方案 → 我的取舍：为什么逻辑放代码、为什么排队写、为什么截图优先）。
- [ ] **Step 4:** 检查截图和说明里不出现真实口令、token、服务器 IP。
- [ ] **Step 5:** 部署；用户与厨师真机走完全流程（早报次日 9 点验证）。
- [ ] **Step 6:** `git commit -m "docs: guide and portfolio"`；推送。

---

## 自检记录

- 规格覆盖：两区菜谱(3,13)；链接/截图优先多图/小红书抖音引导(11,12,13)；小票(14,15)；点单多道+备注+结构化时间+人数(5,9)；接单拒单/出锅/缺料/早报推送(5,6,16)；自动扣库存/低库存/临期(4,5,16)；每日 menu 手动+推荐(16,17)；次数/排行/徽章/统计(5,16,17)；名字+口令(2,8)；VPS 第一天上线、并发排队、不存执行记录、备份(6,7)；里程碑门槛(10,13,15,18)；作品集可读性与材料(6,12,14,16,18)；像素风 A(8)。
- 有意未做：真小程序、支付、多厨房、营养（规格 non-goals）；建议项（同餐合并显示已部分做在厨师分组里、扣库存后校正、早报只推厨师）未纳入，留待用户决定。
