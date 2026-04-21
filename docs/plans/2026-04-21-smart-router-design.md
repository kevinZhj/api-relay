# API 中转站智能路由优化设计

## 1. 项目背景与现状

现有 `api-relay` 项目是一个基于 Fastify + TypeScript + sql.js 的本地API中转站，已实现：
- 多后端账号管理（accounts表）
- API Key 鉴权与限流（api_keys表）
- 使用日志记录（usage_logs表）
- 被动故障检测（429限流恢复、401/403/额度耗尽标记）
- 管理面板（内嵌HTML）
- OpenAI ↔ Anthropic 格式转换

**现有路由算法缺陷**：
`account.selector.ts` 仅按 `priority DESC → last_used_at ASC → id ASC` 排序，是简单的"优先级+轮询"，无法实现：
- 响应速度最优选择
- 成功率加权调度
- 按品牌/模型路由
- 动态权重调整

## 2. 优化目标

实现智能路由引擎，根据以下维度自动选择最优后端账号：
1. **响应速度**：近期平均响应时间最短的优先
2. **成功率**：近期失败率低的优先
3. **额度余量**：剩余额度充足的优先（预留接口，待官方开放查询）
4. **故障状态**：已禁用/限流/额度耗尽的自动排除，并支持自动恢复
5. **模型匹配**：根据请求的模型名，路由到支持该模型的账号
6. **品牌偏好**：支持配置品牌优先级（如优先Kimi，次之GLM）

**上游 API Key 手动管理**：管理面板支持自由添加、删除、修改上游账号，无需重启服务即时生效。每个账号可配置：
- 名称、API Key、Base URL
- 品牌标识（kimi/glm）、协议类型（anthropic/openai）
- 支持的模型列表
- 优先级、路由权重
- 额度上限（手动设置）

**下游工具兼容**：同时支持 OpenAI 格式（Hermes、OpenClaw）和 Anthropic 格式（Claude Code）入口，根据后端协议自动转换。

## 3. 核心设计：智能路由引擎

### 3.1 算法：加权最小响应时间 + 成功率惩罚

对每个活跃账号计算一个路由分数 `score`，分数越低越优先被选中：

```
score = (
  normalized_latency      // 归一化的EWMA平均响应时间，主要因子
  * latency_weight
) * (
  1 + failure_penalty     // 失败惩罚系数，近期失败率越高惩罚越重
) * (
  1 + quota_penalty       // 额度惩罚，剩余额度越少惩罚越重
) / (
  priority_boost          // 优先级加成，越大越容易被选中
)
```

**关键细节**：
- **EWMA响应时间**：使用指数加权移动平均，半衰期 10 次请求，更敏感反映最近性能
- **失败惩罚**：近 50 次请求的失败率，失败率 10% 惩罚 1.2x，50% 惩罚 2.0x，100% 惩罚 10x（直接排除）
- **额度惩罚**：如果 `total_quota` 已知，剩余比例 < 20% 时惩罚 1.5x，< 5% 时 3.0x
- **优先级加成**：`priority` 字段重用，作为倒数加成（priority=10 表示 2x 加成）
- **品牌偏好系数**：新增 `brand_preference` 字段，允许配置品牌级别的偏好

### 3.2 选择策略配置

新增 `ROUTING_STRATEGY` 环境变量，支持：
- `latency` → 默认，上述智能算法
- `round_robin` → 保留现有简单轮询
- `priority` → 仅按优先级
- `random` → 随机（测试用）

### 3.3 选择后的回退机制

当选中的账号请求失败时：
1. 实时更新该账号的失败统计
2. 检查是否需要标记状态（401/403/429/402）
3. 重新计算所有可用账号的 score
4. 选择下一个最优账号重试
5. 最多重试 `MAX_RETRY` 次

## 4. 数据库变更

### 4.1 新增表：account_stats（账号实时性能统计）

```sql
CREATE TABLE account_stats (
  account_id INTEGER PRIMARY KEY,
  -- EWMA 响应时间（毫秒）
  ewma_latency_ms REAL DEFAULT 0,
  -- 近期请求计数（滑动窗口）
  request_count INTEGER DEFAULT 0,
  -- 近期失败计数
  failure_count INTEGER DEFAULT 0,
  -- 连续失败计数（达到阈值直接禁用）
  consecutive_failures INTEGER DEFAULT 0,
  -- 最后一次更新时间
  updated_at TEXT DEFAULT (datetime('now'))
)
```

### 4.2 accounts 表扩展

```sql
-- 新增字段
ALTER TABLE accounts ADD COLUMN brand TEXT DEFAULT ''          -- 品牌标识：kimi / glm
ALTER TABLE accounts ADD COLUMN weight INTEGER DEFAULT 100     -- 路由权重（0-1000）
ALTER TABLE accounts ADD COLUMN is_default INTEGER DEFAULT 0   -- 是否默认渠道
```

### 4.3 新增表：health_probes（主动健康探测日志）

```sql
CREATE TABLE health_probes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  is_success INTEGER DEFAULT 0,
  latency_ms INTEGER,
  error_code TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)
```

## 5. 多厂商协议适配

**核心变更**：现有代码只有 OpenAI 格式入口（`/v1/chat/completions`），但下游工具（Claude Code、Hermes、OpenClaw）可能使用 OpenAI 或 Anthropic 两种协议。必须同时暴露两种协议的入口，并根据后端协议类型自动决定是否需要格式转换。

### 5.1 双协议入口

新增路由：
- `POST /v1/chat/completions` → OpenAI 格式入口（保留现有）
- `POST /v1/messages` → Anthropic 格式入口（新增）
- `GET /v1/models` → 返回两种协议都能用的模型列表

### 5.2 协议转换矩阵

| 入口协议 | 后端协议 | 处理方式 |
|---------|---------|---------|
| OpenAI (`/v1/chat/completions`) | Anthropic (Kimi) | OpenAI→Anthropic 转换（现有） |
| OpenAI | OpenAI (GLM) | 直接转发（新增） |
| Anthropic (`/v1/messages`) | Anthropic (Kimi) | 直接转发（新增） |
| Anthropic | OpenAI (GLM) | Anthropic→OpenAI 转换（新增） |

### 5.3 后端协议检测

每个 account 增加 `protocol` 字段：
- `anthropic` → 后端接收 Anthropic 格式（Kimi Code API）
- `openai` → 后端接收 OpenAI 格式（GLM）
- `auto` → 根据 base_url 自动检测

### 5.4 新增转换器：Anthropic→OpenAI

现有只有 OpenAI→Anthropic 和 Anthropic SSE→OpenAI SSE，需要补入：
- `anthropicToOpenaiRequest`：将 Anthropic 请求体转换为 OpenAI 格式（用于 Anthropic 入口 → OpenAI 后端）
- `openaiToAnthropicResponse`：将 OpenAI 响应转换为 Anthropic 格式（用于 Anthropic 入口 → OpenAI 后端）
- `convertStreamChunkOpenaiToAnthropic`：OpenAI SSE 流转换为 Anthropic SSE 流

### 5.5 模型名映射

新增 `model_aliases` 表或配置，允许将用户请求的模型名映射到后端实际支持的模型名：
```
用户请求: gpt-4 → Kimi后端: kimi-k2.5
用户请求: claude-sonnet → GLM后端: glm-4-plus
```

**下游工具对接指南**：
- **Claude Code CLI**：配置 `ANTHROPIC_API_BASE_URL=http://localhost:3000`，使用 Anthropic 入口
- **Hermes / OpenClaw**：配置 OpenAI 兼容端点，使用 `/v1/chat/completions` 入口

## 6. 额度查询框架（预留）

由于官方是否提供额度API不确定，设计插件化架构：

### 6.1 额度查询插件接口

```typescript
interface QuotaProvider {
  name: string
  // 检查是否支持该品牌
  supports(brand: string, baseUrl: string): boolean
  // 查询剩余额度，返回 { total, used, remaining } 或 null
  async query(apiKey: string, baseUrl: string): Promise<QuotaInfo | null>
}
```

### 6.2 定时任务

每 5 分钟扫描一次所有支持的账号，更新 `accounts.total_quota` 和 `accounts.used_quota`。

### 6.3 目前降级方案

如果暂无官方API，管理面板允许手动设置 `total_quota`，系统自动累计 `used_quota`，当 `used >= total * 0.95` 时自动标记 `quota_exceeded`。

## 7. 主动健康探测

### 7.1 探测触发条件
- 定时器：每 60 秒对所有 `active` 账号执行一次健康探测
- 事件触发：账号被标记为 `rate_limited` 后，探测通过后自动恢复

### 7.2 探测请求
发送一个极轻量请求（如 `max_tokens=1` 的 chat completion），记录：
- 是否成功
- 响应时间
- HTTP 状态码

### 7.3 探测结果处理
- 成功：更新 `account_stats`，如果原状态是非 active 则自动恢复
- 失败：增加连续失败计数，达到阈值（如 3 次）则标记为 `disabled`

## 8. 管理面板增强

### 8.1 账号列表增加字段
- 响应时间趋势图（近 20 次请求的响应时间）
- 近期成功率
- 连续失败次数
- 路由分数排名

### 8.2 新增设置面板
- 路由策略选择（latency / round_robin / priority）
- 权重参数调整（响应时间权重、失败惩罚倍率）
- 手动触发全量健康探测

### 8.3 实时状态
页面添加 WebSocket 或轮询，展示当前正在处理的请求和实时账号负载。

## 9. 配置变更

`.env.example` 新增：
```bash
# 路由策略: latency | round_robin | priority | random
ROUTING_STRATEGY=latency
# 响应时间权重（0.0-2.0，越大越看重响应时间）
LATENCY_WEIGHT=1.0
# 失败惩罚倍率基准（0.5-5.0）
FAILURE_PENALTY_BASE=1.0
# 健康探测间隔（秒）
HEALTH_PROBE_INTERVAL=60
# 连续失败禁用阈值
CONSECUTIVE_FAILURE_THRESHOLD=3
# 额度查询间隔（分钟，0表示禁用）
QUOTA_CHECK_INTERVAL=5
```

## 10. 实施优先级

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| P0 | 智能路由算法 + account_stats 表 + 响应时间追踪 | 2h |
| P0 | 多协议适配（Anthropic / OpenAI 自动切换） | 1.5h |
| P1 | 主动健康探测 + 自动恢复 | 1h |
| P1 | 模型路由（按模型名匹配账号） | 1h |
| P2 | 管理面板增强（响应时间图、路由分数、实时状态） | 2h |
| P2 | 额度查询插件框架（预留接口） | 1h |
| P3 | 模型别名映射系统 | 0.5h |

**总预估：约 9 小时，分 2-3 次交付。**

## 11. 风险与回退

- **响应时间统计异常**：第一次启动时没有历史数据，所有账号 score 相同，回退到随机选择或优先级
- **所有账号同时故障**：如果所有账号都失败，返回 503，管理面板显示故障原因
- **性能影响**：路由计算基于 SQLite 内存查询，延迟 < 1ms，可忽略
- **流式请求的响应时间**：流式请求的总耗时不好统计，可用首字节返回时间作为 latency 代理
