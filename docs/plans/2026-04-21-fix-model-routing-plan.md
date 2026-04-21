# 修复模型名路由匹配问题

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让 `selectAccount` 在路由选择时支持模型别名映射，下游传入 `kimi-k2.5` 时能正确匹配到支持 `K2.6-code-preview` 的上游账号。

**Architecture:** 在 `forwardRequest` 中调用 `selectAccount`/`selectNextAccount` 前，先将模型名通过 `normalizeModelName` 规范化，使路由层的模型过滤与后续日志记录保持一致。

**Tech Stack:** TypeScript, Fastify, sql.js, vitest

---

### Task 1: 修改 proxy.service.ts 中的模型名路由逻辑

**Objective:** 在 `forwardRequest` 中应用 `normalizeModelName` 后再传给账号选择器。

**Files:**
- Modify: `src/modules/proxy/proxy.service.ts`

**Step 1: 修改代码**

将第 54-56 行：

```typescript
    const account = triedIds.length === 0
      ? selectAccount(db, { modelName: proxyReq.body?.model })
      : selectNextAccount(db, triedIds, proxyReq.body?.model)
```

修改为：

```typescript
    const normalizedModel = normalizeModelName(proxyReq.body?.model)
    const account = triedIds.length === 0
      ? selectAccount(db, { modelName: normalizedModel })
      : selectNextAccount(db, triedIds, normalizedModel)
```

**Step 2: 验证编译通过**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: 运行测试**

Run: `pnpm test`
Expected: 48 passed

**Step 4: Commit**

```bash
git add src/modules/proxy/proxy.service.ts
git commit -m "fix(proxy): apply normalizeModelName before account selection for routing"
```

### Task 2: 添加模型别名路由测试

**Objective:** 测试下游传入 `kimi-k2.5` 时能正确选中支持 `K2.6-code-preview` 的账号。

**Files:**
- Modify: `src/modules/proxy/proxy.test.ts`

**Step 1: 添加测试用例**

在 `describe('账号选择与重试')` 中添加：

```typescript
    it('下游传入别名模型名时应该匹配到支持对应正式模型名的账号', async () => {
      createAccount(db, { name: 'kimi', api_key: 'sk-test', models: 'K2.6-code-preview', base_url: 'https://api.kimi.com/coding/' })

      const { forwardRequest } = await import('./proxy.service.js')
      // 模拟一个会失败的请求，只验证账号能被选中（不是503）
      const result = await forwardRequest(db, {
        method: 'POST',
        path: '/v1/chat/completions',
        headers: { 'content-type': 'application/json' },
        body: { model: 'kimi-k2.5', messages: [{ role: 'user', content: 'hi' }] },
      }, 1)

      // 不是 503（没有可用账号），说明别名映射起作用了
      expect(result.status).not.toBe(503)
      expect(result.body?.error?.message).not.toContain('没有可用的后端账号')
    })
```

**Step 2: 运行测试**

Run: `pnpm test`
Expected: 新测试通过，总数 > 48

**Step 3: Commit**

```bash
git add src/modules/proxy/proxy.test.ts
git commit -m "test(proxy): add model alias routing test"
```

### Task 3: 全链路验证

**Objective:** 启动服务，用下游 API Key 和 `kimi-k2.5` 模型名发起请求，确认不再返回 503。

**Step 1: 启动服务**

Run: `npx tsx src/index.ts`

**Step 2: 发起测试请求**

```bash
curl -s http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <downstream-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.5","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'
```

Expected: HTTP 200，不再是 503
