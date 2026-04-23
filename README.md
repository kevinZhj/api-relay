# API Relay - 大模型 API 中转站

多账号自动轮换的大模型 API 代理服务，支持 OpenAI / Anthropic 双协议，内置赛博朋克风格管理面板。

## 功能特性

- **双协议代理** - 同时兼容 OpenAI (`/v1/chat/completions`) 和 Anthropic (`/v1/messages`) 协议，自动格式转换
- **多账号轮换** - 支持 4 种路由策略（延迟优先、轮询、优先级、随机），自动故障转移
- **流式响应** - 完整支持 SSE 流式传输，包括 tool_calls 的双向格式转换
- **健康探测与熔断** - 自动检测账号健康状态，连续失败自动熔断保护
- **API Key 管理** - 设备级 Key 分发，支持速率限制、有效期、Token 配额、模型白名单
- **分组隔离** - Brand 分组机制，不同 Key 绑定不同上游账号池
- **管理面板** - 赛博朋克风格 Web UI，支持账号/Key/分组/日志/审计全流程管理
- **配置导入导出** - JSON 格式一键导出（自动脱敏），支持追加导入
- **上游模型发现** - 自动调用上游 `/v1/models` 接口获取可用模型列表
- **使用日志** - 支持按模型/设备/状态/日期筛选，分页浏览，Token 用量统计
- **审计日志** - 记录所有管理操作，支持追溯

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm（推荐）

### 安装

```bash
git clone https://github.com/kevinZhj/api-relay.git
cd api-relay
pnpm install
```

### 配置

复制 `.env.example` 为 `.env`，修改配置：

```bash
cp .env.example .env
```

关键配置项：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `HOST` | 监听地址 | 0.0.0.0 |
| `DB_PATH` | 数据库路径 | ./data/relay.db |
| `ADMIN_KEY` | 管理员密钥 | 必须修改 |
| `DEFAULT_BASE_URL` | 默认上游 API 地址 | https://api.moonshot.cn/v1 |
| `MAX_RETRY` | 最大重试次数 | 3 |
| `ROUTING_STRATEGY` | 路由策略 | latency |

### 启动

```bash
# 开发模式（热重载）
pnpm dev

# 生产模式
pnpm start
```

启动后访问 `http://localhost:3000/admin` 进入管理面板。

## 使用方式

### 1. 添加上游账号

在管理面板「API 账号」中添加上游 API 账号，填写 Key、Base URL、可用模型等信息。

### 2. 生成设备 Key

在「设备 Key」中生成下发给设备使用的 Key，可设置速率限制、有效期、Token 配额、模型白名单。

### 3. 设备接入

设备使用生成的 Key 接入，支持两种协议：

**OpenAI 协议：**
```
Base URL: http://your-server:3000/v1
API Key:  sk-relay-xxx
```

**Anthropic 协议：**
```
Base URL: http://your-server:3000
API Key:  sk-relay-xxx
```

## 项目结构

```
src/
├── index.ts              # 入口
├── server.ts             # Fastify 服务初始化
├── config.ts             # 配置管理
├── db/
│   ├── index.ts          # 数据库工具函数
│   └── migrations.ts     # 数据库迁移
├── modules/
│   ├── account/          # 账号管理、路由选择、熔断器
│   ├── api_key/          # 设备 Key 管理
│   ├── health/           # 健康探测
│   └── proxy/            # 代理转发、格式转换
└── routes/
    ├── admin.ts          # 管理 API
    ├── admin_page.ts     # 管理面板 UI
    ├── chat.ts           # OpenAI 协议路由
    └── messages.ts       # Anthropic 协议路由
```

## 技术栈

- **Fastify** - 高性能 HTTP 框架
- **sql.js** - 嵌入式 SQLite，零依赖数据库
- **TypeScript** - 类型安全
- **Vitest** - 测试框架

## License

MIT
