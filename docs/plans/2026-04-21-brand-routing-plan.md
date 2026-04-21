# 品牌隔离路由实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 实现按品牌（brand）隔离路由：下游 API Key 绑定品牌（kimi/glm），请求时只路由到同品牌的上游账号。

**Architecture:** 在账号选择层（account.selector.ts）增加 brand 过滤条件；路由层（chat.ts/messages.ts）从验证后的 API Key 中获取 brand 并传递给代理层；管理面板支持创建/编辑 brand。

**Tech Stack:** TypeScript, Fastify, sql.js, vitest

---

### Task 1: 数据库迁移 + 服务层接口补充

**Objective:** 为 api_keys 表添加 brand 字段，并在 TypeScript 接口中补充已有但缺失的字段。

**Files:**
- Modify: `src/db/migrations.ts`
- Modify: `src/modules/api_key/api_key.service.ts`
- Modify: `src/modules/account/account.service.ts`

**Step 1: 修改 migrations.ts**

在平移移除尾部添加：
```typescript
  // 迁移：为 api_keys 表添加品牌字段
  `ALTER TABLE api_keys ADD COLUMN brand TEXT DEFAULT ''`,
```

**Step 2: 修改 api_key.service.ts**

- ApiKey 接口添加 `brand: string`
- `createApiKey` 函数签名改为 `(db: Database, name: string, brand = '', rateLimit = 60)`
- INSERT 语句改为 `INSERT INTO api_keys (key, name, brand, rate_limit) VALUES (?, ?, ?, ?)`
- `listApiKeys` 保持不变（已经 SELECT *）

**Step 3: 修改 account.service.ts**

- Account 接口添加缺失字段：`brand: string`, `protocol: string`, `weight: number`, `is_default: number`
- CreateAccountInput 添加 `brand?: string`
- `createAccount` 的 INSERT 添加 brand字段：`INSERT INTO accounts (name, api_key, base_url, models, brand, priority) VALUES (?, ?, ?, ?, ?, ?)`
- `createAccount` 的参数列表添加 `input.brand || ''`
- `updateAccount` 添加 brand 更新支持：`if (input.brand !== undefined) { fields.push('brand = ?'); values.push(input.brand) }`

**Step 4: 运行测试**

Run: `pnpm test`
Expected: 48 passed

**Step 5: Commit**

```bash
git add src/db/migrations.ts src/modules/api_key/api_key.service.ts src/modules/account/account.service.ts
git commit -m "feat(db,service): add brand field to api_keys and accounts interfaces"
```

---

### Task 2: 路由选择层按品牌过滤

**Objective:** 在账号选择器中增加 brand 过滤，在代理服务中传递 brand 参数。

**Files:**
- Modify: `src/modules/account/account.selector.ts`
- Modify: `src/modules/proxy/proxy.service.ts`

**Step 1: 修改 account.selector.ts**

- RoutingOptions 添加 `brand?: string`
- 在 `selectAccount` 中，模型匹配之后添加 brand 过滤：
```typescript
  if (options?.brand) {
    candidates = candidates.filter(a => a.brand === options.brand)
  }
```

**Step 2: 修改 proxy.service.ts**

- `forwardRequest` 函数签名添加 `brand?: string` 参数：`export const forwardRequest = async (db: Database, proxyReq: ProxyRequest, apiKeyId: number, brand?: string, onLog?: ...)`
- 在调用 `selectAccount` 和 `selectNextAccount` 时传入 brand：
```typescript
    const account = triedIds.length === 0
      ? selectAccount(db, { modelName: proxyReq.body?.model, brand })
      : selectNextAccount(db, triedIds, proxyReq.body?.model, brand)
```
- 注意：selectNextAccount 也需要支持 brand 参数，所以要修改调用为 `selectNextAccount(db, triedIds, proxyReq.body?.model, brand)`
- 同时修改 `selectNextAccount` 函数签名：`export const selectNextAccount = (db: Database, excludeIds: number[], modelName?: string, brand?: string): Account | null`
- 并修改其内部调用：`return selectAccount(db, { excludeIds, modelName, brand })`

**Step 3: 运行测试**

Run: `pnpm test`
Expected: 48 passed

**Step 4: Commit**

```bash
git add src/modules/account/account.selector.ts src/modules/proxy/proxy.service.ts
git commit -m "feat(routing): filter accounts by brand in selector and forwardRequest"
```

---

### Task 3: 路由入口传递 brand

**Objective:** 在 chat.ts 和 messages.ts 中获取 API Key 的 brand并传给 forwardRequest。

**Files:**
- Modify: `src/routes/chat.ts`
- Modify: `src/routes/messages.ts`

**Step 1: 修改 chat.ts**

在调用 `forwardRequest` 时，在 `apiKey.id` 之后添加 `apiKey.brand` 参数：
```typescript
    const result = await forwardRequest(
      db,
      { ... },
      apiKey.id,
      apiKey.brand || undefined,
      (log) => { ... },
    )
```

**Step 2: 修改 messages.ts**

同理，在调用 `forwardRequest` 时添加 `apiKey.brand || undefined` 参数。

**Step 3: 运行测试**

Run: `pnpm test`
Expected: 48 passed

**Step 4: Commit**

```bash
git add src/routes/chat.ts src/routes/messages.ts
git commit -m "feat(routes): pass apiKey brand to forwardRequest in chat and messages endpoints"
```

---

### Task 4: 管理 API 支持 brand

**Objective:** 管理后端创建/更新账号和 API Key 时支持 brand 字段。

**Files:**
- Modify: `src/routes/admin.ts`

**Step 1: 修改创建 API Key**

在 `/admin/api-keys` POST 处，从 body 中读取 brand：
```typescript
  app.post('/admin/api-keys', async (request, reply) => {
    try {
      const { name, rate_limit, brand } = request.body as any
      const result = createApiKey(db, name, brand, rate_limit)
      ...
    }
  })
```

**Step 2: 修改创建账号**

在 `/admin/accounts` POST 处，body 已经包含 brand（因为 createAccount 接受 CreateAccountInput），不需修改。

**Step 3: 修改更新账号**

在 `/admin/accounts/:id` PUT 处，body 已经包含 brand（因为 updateAccount 支持 brand 了），不需修改。

**Step 4: Commit**

```bash
git add src/routes/admin.ts
git commit -m "feat(admin): support brand field in api-key creation"
```

---

### Task 5: 管理面板 UI 支持 brand

**Objective:** 在管理面板中增加 brand 选择和显示。

**Files:**
- Modify: `src/routes/admin_page.ts`

**Step 1: 添加账号对话框 brand 选项**

在 `addAccountDialog` 中，在协议选择下方添加：
```html
    <label>品牌</label>
    <select id="accBrand">
      <option value="" selected>不限定</option>
      <option value="kimi">kimi</option>
      <option value="glm">glm</option>
    </select>
```

在 `editAccountDialog` 中同样添加 brand 选择。

**Step 2: 添加 API Key 对话框 brand 选项**

在 `addKeyDialog` 中，在速率限制之上添加：
```html
    <label>品牌</label>
    <select id="keyBrand">
      <option value="" selected>不限定</option>
      <option value="kimi">kimi</option>
      <option value="glm">glm</option>
    </select>
```

**Step 3: 更新账号列表显示**

在 `loadAccounts` 的表格中，在协议列之后添加品牌列：
表头改为：`<th>ID</th><th>名称</th><th>品牌</th><th>协议</th>...`
行内数据添加：`'<td><span class="badge">' + (a.brand || '-') + '</span></td>' +`

**Step 4: 更新 API Key 列表显示**

在 `loadKeys` 的表格中，在名称之后添加品牌列：
表头改为：`<th>ID</th><th>名称</th><th>品牌</th><th>Key</th>...`
行内数据添加：`'<td><span class="badge">' + (k.brand || '-') + '</span></td>' +`

**Step 5: 更新 doAddAccount 和 doEditAccount**

在 `doAddAccount` 中读取并传送 brand：
```javascript
  const brand = document.getElementById('accBrand').value
  if (brand) body.brand = brand
```

在 `doEditAccount` 中同样添加 brand 读取和传送。

在 `showEditAccount` 中设置 brand 值：
```javascript
  document.getElementById('editAccBrand').value = a.brand || ''
```

在 `doAddKey` 中读取并传送 brand：
```javascript
  const brand = document.getElementById('keyBrand').value
  const r = await api('POST', '/admin/api-keys', { name, brand, rate_limit })
```

**Step 6: Commit**

```bash
git add src/routes/admin_page.ts
git commit -m "feat(admin-ui): add brand selection and display in management panel"
```

---

### Task 6: 添加品牌路由测试

**Objective:** 验证按品牌路由逻辑正确。

**Files:**
- Modify: `src/modules/proxy/proxy.test.ts`

**Step 1: 添加测试用例**

在 `proxy.test.ts` 中添加两个测试：
1. 下游 brand=kimi 时只路由到 kimi 账号
2. 下游 brand=glm 时不路由到 kimi 账号（503）

```typescript
    it('按品牌路由：kimi 账号匹配 kimi brand 请求', async () => {
      createAccount(db, { name: 'kimi', api_key: 'sk-kimi', brand: 'kimi', base_url: 'https://api.kimi.com/coding/' })
      createAccount(db, { name: 'glm', api_key: 'sk-glm', brand: 'glm', base_url: 'https://api.glm.com/v1/' })

      const { forwardRequest } = await import('./proxy.service.js')
      const result = await forwardRequest(db, {
        method: 'POST',
        path: '/v1/chat/completions',
        headers: { 'content-type': 'application/json' },
        body: { model: 'kimi-k2.5', messages: [{ role: 'user', content: 'hi' }] },
      }, 1, 'kimi')

      // 不是 503，说明找到了 kimi 品牌的账号
      expect(result.status).not.toBe(503)
    })

    it('按品牌路由：glm brand 不会匹配到 kimi 账号', async () => {
      createAccount(db, { name: 'kimi', api_key: 'sk-kimi', brand: 'kimi', base_url: 'https://api.kimi.com/coding/' })

      const { forwardRequest } = await import('./proxy.service.js')
      const result = await forwardRequest(db, {
        method: 'POST',
        path: '/v1/chat/completions',
        headers: { 'content-type': 'application/json' },
        body: { model: 'kimi-k2.5', messages: [{ role: 'user', content: 'hi' }] },
      }, 1, 'glm')

      expect(result.status).toBe(503)
    })
```

**Step 2: 运行测试**

Run: `pnpm test`
Expected: 全部通过

**Step 3: Commit**

```bash
git add src/modules/proxy/proxy.test.ts
git commit -m "test(proxy): add brand-based routing tests"
```

---

### Task 7: 全链路验证

**Objective:** 启动服务，验证品牌路由工作正常。

**Step 1: 启动服务**

Run: `npx tsx src/index.ts`

**Step 2: 测试无 brand 的 Key**

使用现有的 hermes Key（brand 为空），发送 `kimi-k2.5` 请求，应该 200（因为无 brand 不限定）。

**Step 3: 测试按品牌路由**

通过管理面板创建一个 brand=kimi 的 Key，发送请求验证只路由到 kimi 账号。
