import { FastifyInstance } from 'fastify'
import { Database } from 'sql.js'

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API 中转站管理</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
.header { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
.header h1 { font-size: 20px; font-weight: 600; }
.header .status { font-size: 13px; color: #94a3b8; }
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; width: 360px; }
.login-box h2 { margin-bottom: 20px; font-size: 18px; text-align: center; }
.login-box input { width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #e2e8f0; font-size: 14px; outline: none; }
.login-box input:focus { border-color: #3b82f6; }
.login-box button { width: 100%; margin-top: 16px; padding: 10px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.login-box button:hover { background: #2563eb; }
.main { display: none; max-width: 1100px; margin: 0 auto; padding: 24px; }
.tabs { display: flex; gap: 4px; margin-bottom: 24px; background: #1e293b; border-radius: 8px; padding: 4px; }
.tab { padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; color: #94a3b8; border: none; background: transparent; }
.tab.active { background: #3b82f6; color: #fff; }
.tab:hover:not(.active) { color: #e2e8f0; }
.panel { display: none; }
.panel.active { display: block; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
.card .label { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
.card .value { font-size: 28px; font-weight: 700; }
.card .value.green { color: #22c55e; }
.card .value.yellow { color: #eab308; }
.card .value.red { color: #ef4444; }
.card .value.blue { color: #3b82f6; }
table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; font-size: 14px; }
th { background: #0f172a; color: #94a3b8; font-weight: 500; font-size: 12px; text-transform: uppercase; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #334155; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.badge.active { background: #166534; color: #86efac; }
.badge.disabled { background: #7f1d1d; color: #fca5a5; }
.badge.rate_limited { background: #713f12; color: #fde047; }
.badge.quota_exceeded { background: #581c87; color: #d8b4fe; }
.btn { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 4px; }
.btn-sm { padding: 4px 8px; font-size: 12px; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-danger { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn-warn { background: #d97706; color: #fff; }
.btn-warn:hover { background: #b45309; }
.btn-success { background: #16a34a; color: #fff; }
.btn-success:hover { background: #15803d; }
.btn-info { background: #0891b2; color: #fff; }
.btn-info:hover { background: #0e7490; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.actions-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.dialog-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
.dialog-overlay.show { display: flex; }
.dialog { background: #1e293b; border: 1px solid #475569; border-radius: 12px; padding: 24px; width: 440px; max-width: 90vw; max-height: 80vh; overflow-y: auto; }
.dialog h3 { margin-bottom: 16px; font-size: 16px; }
.dialog label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 4px; margin-top: 12px; }
.dialog input, .dialog select { width: 100%; padding: 8px 10px; background: #0f172a; border: 1px solid #475569; border-radius: 4px; color: #e2e8f0; font-size: 14px; outline: none; }
.dialog input:focus { border-color: #3b82f6; }
.dialog .btn-row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; font-size: 14px; z-index: 200; display: none; }
.toast.success { background: #166534; color: #86efac; display: block; }
.toast.error { background: #7f1d1d; color: #fca5a5; display: block; }
.key-text { font-family: monospace; font-size: 12px; color: #94a3b8; word-break: break-all; }
.copy-btn { cursor: pointer; color: #3b82f6; font-size: 12px; margin-left: 8px; }
.copy-btn:hover { color: #60a5fa; }
.empty { text-align: center; padding: 40px; color: #64748b; }
.test-result { margin-top: 12px; padding: 12px; background: #0f172a; border-radius: 6px; font-size: 13px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
.test-result.ok { border: 1px solid #22c55e; }
.test-result.fail { border: 1px solid #ef4444; }
</style>
</head>
<body>

<div id="loginPage" class="login-wrap">
  <div class="login-box">
    <h2>API 中转站</h2>
    <input type="password" id="keyInput" placeholder="输入管理员密钥" onkeydown="if(event.key==='Enter')doLogin()">
    <button onclick="doLogin()">登录</button>
  </div>
</div>

<div id="mainPage" class="main">
  <div class="header">
    <h1>API 中转站管理</h1>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="status" id="refreshStatus">自动刷新: 30s</span>
      <button class="btn btn-primary btn-sm" id="refreshBtn" onclick="manualRefresh()">刷新</button>
    </div>
  </div>

  <div class="tabs" style="margin-top:20px">
    <button class="tab active" onclick="switchTab('overview')">概览</button>
    <button class="tab" onclick="switchTab('accounts')">API 账号</button>
    <button class="tab" onclick="switchTab('apikeys')">设备 Key</button>
    <button class="tab" onclick="switchTab('usage')">使用日志</button>
  </div>

  <div id="panel-overview" class="panel active">
    <div class="cards" id="healthCards"></div>
  </div>

  <div id="panel-accounts" class="panel">
    <div class="actions-bar">
      <span style="font-size:16px;font-weight:600">API 账号管理</span>
      <button class="btn btn-primary" onclick="showAddAccount()">添加账号</button>
    </div>
    <table>
      <thead><tr><th>ID</th><th>名称</th><th>Brand</th><th>协议</th><th>API Key</th><th>Base URL</th><th>模型</th><th>状态</th><th>优先级</th><th>响应时间</th><th>成功率</th><th>连败</th><th>已用额度</th><th>最后错误</th><th>操作</th></tr></thead>
      <tbody id="accountsBody"></tbody>
    </table>
  </div>

  <div id="panel-apikeys" class="panel">
    <div class="actions-bar">
      <span style="font-size:16px;font-weight:600">设备 API Key</span>
      <button class="btn btn-primary" onclick="showAddKey()">生成新 Key</button>
    </div>
    <div id="keyUrlBar" style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;font-size:13px">
    </div>
    <table>
      <thead><tr><th>ID</th><th>名称</th><th>Brand</th><th>Key</th><th>状态</th><th>速率限制</th><th>使用统计</th><th>操作</th></tr></thead>
      <tbody id="keysBody"></tbody>
    </table>
  </div>

  <div id="panel-usage" class="panel">
    <div class="actions-bar">
      <span style="font-size:16px;font-weight:600">使用日志</span>
      <button class="btn btn-primary" onclick="loadUsage()">刷新</button>
    </div>
    <table>
      <thead><tr><th>时间</th><th>模型</th><th>账号ID</th><th>输入</th><th>输出</th><th>耗时</th><th>状态</th></tr></thead>
      <tbody id="usageBody"></tbody>
    </table>
  </div>
</div>

<div id="addAccountDialog" class="dialog-overlay">
  <div class="dialog">
    <h3>添加 API 账号</h3>
    <label>名称</label><input id="accName" placeholder="如：Kimi账号1">
    <label>API Key</label><input id="accKey" placeholder="sk-xxx">
    <label>Base URL</label><input id="accUrl" placeholder="https://api.moonshot.cn/v1">
    <label>可用模型（逗号分隔）</label><input id="accModels" placeholder="kimi-k2.5,claude-sonnet-4-6">
    <label>协议</label>
    <select id="accProtocol">
      <option value="auto" selected>auto (自动检测)</option>
      <option value="anthropic">anthropic (Kimi)</option>
      <option value="openai">openai (GLM)</option>
    </select>
    <label>Brand</label>
    <select id=accBrand>
      <option value=" selected>Unlimited</option>
      <option value=kimi>kimi</option>
      <option value=glm>glm</option>
    </select>
    <label>优先级（越大越优先）</label><input id="accPriority" type="number" value="0">
    <div class="btn-row">
      <button class="btn" onclick="closeDialog('addAccountDialog')">取消</button>
      <button class="btn btn-primary" onclick="doAddAccount()">添加</button>
    </div>
  </div>
</div>

<div id="editAccountDialog" class="dialog-overlay">
  <div class="dialog">
    <h3>修改账号</h3>
    <input type="hidden" id="editAccId">
    <label>名称</label><input id="editAccName">
    <label>API Key</label><input id="editAccKey">
    <label>Base URL</label><input id="editAccUrl">
    <label>可用模型（逗号分隔）</label><input id="editAccModels">
    <label>协议</label>
    <select id="editAccProtocol">
      <option value="auto">auto (自动检测)</option>
      <option value="anthropic">anthropic (Kimi)</option>
      <option value="openai">openai (GLM)</option>
    </select>
    <label>Brand</label>
    <select id=editAccBrand>
      <option value=">Unlimited</option>
      <option value=kimi>kimi</option>
      <option value=glm>glm</option>
    </select>
    <label>优先级</label><input id="editAccPriority" type="number">
    <div class="btn-row">
      <button class="btn" onclick="closeDialog('editAccountDialog')">取消</button>
      <button class="btn btn-primary" onclick="doEditAccount()">保存</button>
    </div>
  </div>
</div>

<div id="testAccountDialog" class="dialog-overlay">
  <div class="dialog">
    <h3>测试账号连通性</h3>
    <input type="hidden" id="testAccId">
    <p style="color:#94a3b8;font-size:13px">向该账号的 Base URL 发送一个最小请求，验证 Key 和地址是否可用。</p>
    <div class="btn-row" style="margin-top:16px">
      <button class="btn" onclick="closeDialog('testAccountDialog')">关闭</button>
      <button class="btn btn-info" id="testBtn" onclick="doTestAccount()">开始测试</button>
    </div>
    <div id="testResult" style="display:none"></div>
  </div>
</div>

<div id="addKeyDialog" class="dialog-overlay">
  <div class="dialog">
    <h3>生成设备 Key</h3>
    <label>设备名称</label><input id="keyName" placeholder="如：我的电脑">
    <label>速率限制（请求/分钟）</label><input id="keyRate" type="number" value="60">
    <label>Brand</label>
    <select id=keyBrand>
      <option value=" selected>Unlimited</option>
      <option value=kimi>kimi</option>
      <option value=glm>glm</option>
    </select>
    <div class="btn-row">
      <button class="btn" onclick="closeDialog('addKeyDialog')">取消</button>
      <button class="btn btn-primary" onclick="doAddKey()">生成</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
let ADMIN_KEY = ''
let refreshTimer = null
let refreshCountdown = 30

const startAutoRefresh = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshCountdown = 30
  const updateStatus = () => {
    const el = document.getElementById('refreshStatus')
    if (el) el.textContent = '自动刷新: ' + refreshCountdown + 's'
  }
  updateStatus()
  refreshTimer = setInterval(() => {
    refreshCountdown--
    if (refreshCountdown <= 0) {
      loadAll()
      refreshCountdown = 30
    }
    updateStatus()
  }, 1000)
}

const manualRefresh = () => {
  loadAll()
  refreshCountdown = 30
  toast('已刷新')
}
const api = async (method, path, body) => {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + ADMIN_KEY } }
  if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const r = await fetch(path, opts)
  const data = await r.json().catch(() => ({ error: { message: 'Invalid response: ' + r.status } }))
  if (!r.ok) {
    const msg = data.error?.message || data.message || ('Request failed: ' + r.status)
    throw new Error(msg)
  }
  return data
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.className = 'toast ' + type
  setTimeout(() => { el.className = 'toast' }, 3000)
}

function closeDialog(id) { document.getElementById(id).classList.remove('show') }
function showDialog(id) { document.getElementById(id).classList.add('show') }

function doLogin() {
  ADMIN_KEY = document.getElementById('keyInput').value.trim()
  if (!ADMIN_KEY) return
  localStorage.setItem('admin_key', ADMIN_KEY)
  showMain()
}

function showMain() {
  loadAll()
  startAutoRefresh()
  document.getElementById('loginPage').style.display = 'none'
  document.getElementById('mainPage').style.display = 'block'
}

// 自动登录
;(function() {
  const saved = localStorage.getItem('admin_key')
  if (saved) { ADMIN_KEY = saved; showMain() }
})()

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const panels = ['overview', 'accounts', 'apikeys', 'usage']
    t.classList.toggle('active', panels[i] === name)
  })
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.getElementById('panel-' + name).classList.add('active')
  if (name === 'overview') loadHealth()
  if (name === 'accounts') loadAccounts()
  if (name === 'apikeys') loadKeys()
  if (name === 'usage') loadUsage()
}

function loadAll() { loadHealth(); loadAccounts(); loadKeys() }

async function loadHealth() {
  const d = await api('GET', '/admin/health')
  const s = d.summary
  document.getElementById('healthCards').innerHTML =
    '<div class="card"><div class="label">总账号数</div><div class="value blue">' + s.total + '</div></div>' +
    '<div class="card"><div class="label">活跃账号</div><div class="value green">' + s.active + '</div></div>' +
    '<div class="card"><div class="label">限流中</div><div class="value yellow">' + s.rate_limited + '</div></div>' +
    '<div class="card"><div class="label">已禁用</div><div class="value red">' + (s.disabled + s.quota_exceeded) + '</div></div>'
}

async function loadAccounts() {
  const [list, stats] = await Promise.all([
    api('GET', '/admin/accounts'),
    api('GET', '/admin/routing-stats').catch(() => [])
  ])
  const statMap = {}
  for (const s of stats) statMap[s.id] = s

  if (!list.length) { document.getElementById('accountsBody').innerHTML = '<tr><td colspan="15" class="empty">暂无账号</td></tr>'; return }
  document.getElementById('accountsBody').innerHTML = list.map(a => {
    const st = statMap[a.id] || {}
    const latencyColor = st.ewma_latency_ms > 3000 ? 'color:#ef4444' : (st.ewma_latency_ms > 1000 ? 'color:#eab308' : 'color:#22c55e')
    return '<tr><td>' + a.id + '</td><td>' + a.name + '</td>' +
    '<td>' + (a.brand || '-') + '</td>' +
    '<td><span class="badge ' + (a.protocol || 'auto') + '">' + (a.protocol || 'auto') + '</span></td>' +
    '<td><span class="key-text">' + a.api_key.slice(0, 12) + '...' + a.api_key.slice(-4) + '</span></td>' +
    '<td><span class="key-text">' + (a.base_url || '-') + '</span></td>' +
    '<td>' + (a.models || '-') + '</td>' +
    '<td><span class="badge ' + a.status + '">' + a.status + '</span></td>' +
    '<td>' + a.priority + '</td>' +
    '<td style="' + latencyColor + '">' + (st.ewma_latency_ms || 0) + 'ms</td>' +
    '<td>' + (st.failure_rate || '0.0%') + '</td>' +
    '<td>' + (st.consecutive_failures || 0) + '</td>' +
    '<td>' + a.used_quota + '</td>' +
    '<td>' + (a.last_error || '-') + '</td>' +
    '<td>' +
      '<button class="btn btn-info btn-sm" onclick="showTestAccount(' + a.id + ')">测试</button>' +
      '<button class="btn btn-primary btn-sm" onclick="showEditAccount(' + a.id + ')">修改</button>' +
      (a.status === 'active'
        ? '<button class="btn btn-warn btn-sm" onclick="toggleAccount(' + a.id + ')">禁用</button>'
        : '<button class="btn btn-success btn-sm" onclick="toggleAccount(' + a.id + ')">启用</button>') +
      '<button class="btn btn-danger btn-sm" onclick="delAccount(' + a.id + ')">删除</button>' +
    '</td></tr>'
  }).join('')
}

async function loadKeys() {
  const list = await api('GET', '/admin/api-keys')
  const stats = await api('GET', '/admin/stats')
  const base = location.origin
  document.getElementById('keyUrlBar').innerHTML =
    '<div><span style="color:#94a3b8">Anthropic: </span><span class="key-text">' + base + '/</span></div>' +
    '<div><span style="color:#94a3b8">OpenAI: </span><span class="key-text">' + base + '/v1</span></div>'
  if (!list.length) { document.getElementById('keysBody').innerHTML = '<tr><td colspan="8" class="empty">暂无 Key</td></tr>'; return }
  // 按 api_key_id 分组统计
  const keyStats = {}
  for (const s of stats) {
    if (!keyStats[s.api_key_id]) keyStats[s.api_key_id] = []
    keyStats[s.api_key_id].push(s)
  }
  document.getElementById('keysBody').innerHTML = list.map(k => {
    const ks = keyStats[k.id] || []
    const statsHtml = ks.length
      ? ks.map(s =>
          '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#94a3b8">' +
            '<span>' + (s.model || '-') + '</span>' +
            '<span>请求 <b style="color:#e2e8f0">' + s.request_count + '</b></span>' +
            '<span>输入 <b style="color:#60a5fa">' + (s.total_input || 0) + '</b></span>' +
            '<span>输出 <b style="color:#34d399">' + (s.total_output || 0) + '</b></span>' +
            '<span>缓存写 <b style="color:#fbbf24">' + (s.total_cache_write || 0) + '</b></span>' +
            '<span>缓存读 <b style="color:#a78bfa">' + (s.total_cache_read || 0) + '</b></span>' +
            '<span>合计 <b style="color:#f472b6">' + (s.total_tokens || 0) + '</b></span>' +
          '</div>'
        ).join('')
      : '<div style="font-size:12px;color:#475569">暂无使用数据</div>'
    return '<tr><td>' + k.id + '</td><td>' + k.name + '</td>' +
    '<td>' + (k.brand || '-') + '</td>' +
    '<td><span class="key-text" id="key-' + k.id + '">' + k.key + '</span>' +
    '<span class="copy-btn" onclick="copyKey(' + k.id + ')">复制</span></td>' +
    '<td><span class="badge ' + (k.is_active ? 'active' : 'disabled') + '">' + (k.is_active ? '启用' : '禁用') + '</span></td>' +
    '<td>' + k.rate_limit + '/分钟</td>' +
    '<td>' + statsHtml + '</td>' +
    '<td>' +
      (k.is_active
        ? '<button class="btn btn-warn btn-sm" onclick="toggleKey(' + k.id + ')">禁用</button>'
        : '<button class="btn btn-success btn-sm" onclick="toggleKey(' + k.id + ')">启用</button>') +
      '<button class="btn btn-danger btn-sm" onclick="delKey(' + k.id + ')">删除</button>' +
    '</td></tr>'
  }).join('')
}

async function loadUsage() {
  const d = await api('GET', '/admin/usage?limit=50')
  const list = d.logs || []
  if (!list.length) { document.getElementById('usageBody').innerHTML = '<tr><td colspan="7" class="empty">暂无日志</td></tr>'; return }
  document.getElementById('usageBody').innerHTML = list.map(l =>
    '<tr><td>' + (l.created_at || '-') + '</td>' +
    '<td>' + (l.model || '-') + '</td>' +
    '<td>' + (l.account_id || '-') + '</td>' +
    '<td>' + (l.prompt_tokens || 0) + '</td>' +
    '<td>' + (l.completion_tokens || 0) + '</td>' +
    '<td>' + (l.duration_ms || 0) + 'ms</td>' +
    '<td><span class="badge ' + (l.is_success ? 'active' : 'disabled') + '">' + (l.is_success ? '成功' : '失败 ' + (l.error_code || '')) + '</span></td></tr>'
  ).join('')
}

function showAddAccount() { showDialog('addAccountDialog') }
function showAddKey() { showDialog('addKeyDialog') }

async function showEditAccount(id) {
  const a = await api('GET', '/admin/accounts/' + id)
  if (a.error) { toast('账号不存在', 'error'); return }
  document.getElementById('editAccId').value = a.id
  document.getElementById('editAccName').value = a.name
  document.getElementById('editAccKey').value = a.api_key
  document.getElementById('editAccUrl').value = a.base_url || ''
  document.getElementById('editAccModels').value = a.models || ''
  document.getElementById('editAccProtocol').value = a.protocol || 'auto'
  document.getElementById('editAccBrand').value = a.brand || ''
  document.getElementById('editAccPriority').value = a.priority
  showDialog('editAccountDialog')
}

async function doEditAccount() {
  const id = document.getElementById('editAccId').value
  const body = {}
  const name = document.getElementById('editAccName').value.trim()
  const api_key = document.getElementById('editAccKey').value.trim()
  const base_url = document.getElementById('editAccUrl').value.trim()
  const models = document.getElementById('editAccModels').value.trim()
  const protocol = document.getElementById('editAccProtocol').value
  const brand = document.getElementById('editAccBrand').value
  const priority = document.getElementById('editAccPriority').value
  if (name) body.name = name
  if (api_key) body.api_key = api_key
  if (base_url) body.base_url = base_url
  if (models !== undefined) body.models = models
  if (protocol) body.protocol = protocol
  if (brand !== undefined) body.brand = brand
  if (priority !== '') body.priority = Number(priority)
  try {
    await api('PUT', '/admin/accounts/' + id, body)
    closeDialog('editAccountDialog')
    toast('已更新')
    loadAccounts(); loadHealth()
  } catch (err) {
    toast('更新失败: ' + err.message, 'error')
  }
}

function showTestAccount(id) {
  document.getElementById('testAccId').value = id
  document.getElementById('testResult').style.display = 'none'
  document.getElementById('testBtn').disabled = false
  showDialog('testAccountDialog')
}

async function doTestAccount() {
  const id = document.getElementById('testAccId').value
  const btn = document.getElementById('testBtn')
  btn.disabled = true
  btn.textContent = '测试中...'
  const resultEl = document.getElementById('testResult')
  resultEl.style.display = 'none'

  const r = await api('POST', '/admin/accounts/' + id + '/test')
  resultEl.style.display = 'block'

  if (r.ok) {
    resultEl.className = 'test-result ok'
    const resp = r.response || {}
    const usage = resp.usage || {}
    resultEl.textContent =
      '状态: ' + r.status + ' OK\\n' +
      '耗时: ' + r.duration_ms + 'ms\\n' +
      '模型: ' + (resp.model || '-') + '\\n' +
      'Token: prompt=' + (usage.prompt_tokens || 0) + ' completion=' + (usage.completion_tokens || 0)
    toast('连接成功')
  } else if (r.error) {
    resultEl.className = 'test-result fail'
    resultEl.textContent = '连接失败: ' + r.error
    toast('连接失败', 'error')
  } else {
    resultEl.className = 'test-result fail'
    const resp = r.response || {}
    const errMsg = resp.error?.message || JSON.stringify(resp)
    resultEl.textContent =
      '状态: ' + r.status + '\\n' +
      '耗时: ' + r.duration_ms + 'ms\\n' +
      '错误: ' + errMsg
    toast('请求失败: ' + r.status, 'error')
  }

  btn.disabled = false
  btn.textContent = '重新测试'
}

async function doAddAccount() {
  const name = document.getElementById('accName').value.trim()
  const api_key = document.getElementById('accKey').value.trim()
  if (!name || !api_key) { toast('请填写名称和API Key', 'error'); return }
  const body = { name, api_key }
  const url = document.getElementById('accUrl').value.trim()
  const models = document.getElementById('accModels').value.trim()
  const protocol = document.getElementById('accProtocol').value
  const brand = document.getElementById('accBrand').value
  const priority = document.getElementById('accPriority').value
  if (url) body.base_url = url
  if (models) body.models = models
  if (protocol) body.protocol = protocol
  if (brand) body.brand = brand
  if (priority) body.priority = Number(priority)
  try {
    await api('POST', '/admin/accounts', body)
    closeDialog('addAccountDialog')
    toast('账号已添加')
    loadAccounts(); loadHealth()
    document.getElementById('accName').value = ''
    document.getElementById('accKey').value = ''
    document.getElementById('accUrl').value = ''
    document.getElementById('accModels').value = ''
    document.getElementById('accProtocol').value = 'auto'
    document.getElementById('accBrand').value = ''
    document.getElementById('accPriority').value = '0'
  } catch (err) {
    toast('添加失败: ' + err.message, 'error')
  }
}

async function doAddKey() {
  const name = document.getElementById('keyName').value.trim()
  if (!name) { toast('请填写设备名称', 'error'); return }
  const rate_limit = Number(document.getElementById('keyRate').value) || 60
  const brand = document.getElementById('keyBrand').value
  const r = await api('POST', '/admin/api-keys', { name, brand, rate_limit })
  closeDialog('addKeyDialog')
  toast('Key 已生成: ' + r.key)
  loadKeys()
  document.getElementById('keyName').value = ''
  document.getElementById('keyRate').value = '60'
  document.getElementById('keyBrand').value = ''
}

async function toggleAccount(id) { await api('POST', '/admin/accounts/' + id + '/toggle'); loadAccounts(); loadHealth() }
async function delAccount(id) { if (!confirm('确定删除？')) return; await api('DELETE', '/admin/accounts/' + id); toast('已删除'); loadAccounts(); loadHealth() }
async function toggleKey(id) { await api('POST', '/admin/api-keys/' + id + '/toggle'); loadKeys() }
async function delKey(id) { if (!confirm('确定删除？')) return; await api('DELETE', '/admin/api-keys/' + id); toast('已删除'); loadKeys() }

function copyKey(id) {
  const el = document.getElementById('key-' + id)
  navigator.clipboard.writeText(el.textContent)
  toast('已复制到剪贴板')
}
</script>
</body>
</html>`

export const registerAdminPage = (app: FastifyInstance, db: Database) => {
  app.get('/admin', async (_request, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8')
    return reply.send(ADMIN_HTML)
  })
}
