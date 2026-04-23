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
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #060a14; background-image: linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px); background-size: 40px 40px; color: #c8d6e5; min-height: 100vh; }
body::after { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px); pointer-events: none; z-index: 9999; }
.header { background: linear-gradient(135deg, rgba(10,18,36,0.95) 0%, rgba(6,14,30,0.95) 100%); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,229,255,0.2); box-shadow: 0 1px 20px rgba(0,229,255,0.05); padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
.header h1 { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
.header h1::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #00e5ff; box-shadow: 0 0 8px #00e5ff, 0 0 16px rgba(0,229,255,0.4); animation: pulse 2s ease-in-out infinite; }
.header .status { font-size: 12px; color: #4b5e7a; }
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: radial-gradient(ellipse at 50% 40%, rgba(0,229,255,0.08) 0%, transparent 50%), linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px), #060a14; background-size: 100% 100%, 40px 40px, 40px 40px; }
.login-box { background: rgba(10,18,36,0.85); backdrop-filter: blur(16px); border: 1px solid rgba(0,229,255,0.2); border-radius: 16px; padding: 40px; width: 380px; box-shadow: 0 0 40px rgba(0,229,255,0.08), 0 20px 60px rgba(0,0,0,0.5); }
.login-box h2 { margin-bottom: 20px; font-size: 18px; text-align: center; color: #e2e8f0; text-shadow: 0 0 10px rgba(0,229,255,0.3); letter-spacing: 1px; }
.login-box input { width: 100%; padding: 12px 14px; background: rgba(6,10,20,0.8); border: 1px solid rgba(0,229,255,0.15); border-radius: 8px; color: #e2e8f0; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
.login-box input:focus { border-color: #00e5ff; box-shadow: 0 0 0 3px rgba(0,229,255,0.1), 0 0 12px rgba(0,229,255,0.1); }
.login-box button { width: 100%; margin-top: 20px; padding: 12px; background: linear-gradient(135deg, #00b8d4, #00e5ff); color: #060a14; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: box-shadow 0.2s, transform 0.1s; letter-spacing: 0.5px; }
.login-box button:hover { box-shadow: 0 0 20px rgba(0,229,255,0.4); transform: translateY(-1px); }
.main { display: none; max-width: 1400px; margin: 0 auto; padding: 20px 24px; }
.tabs { display: flex; gap: 2px; margin-bottom: 24px; background: rgba(10,18,36,0.7); backdrop-filter: blur(12px); border-radius: 10px; padding: 4px; border: 1px solid rgba(0,229,255,0.1); }
.tab { padding: 9px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #4b5e7a; border: none; background: transparent; transition: all 0.2s; white-space: nowrap; }
.tab.active { background: linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.1)); color: #00e5ff; box-shadow: 0 0 12px rgba(0,229,255,0.15); text-shadow: 0 0 8px rgba(0,229,255,0.3); }
.tab:hover:not(.active) { color: #94a3b8; background: rgba(0,229,255,0.05); }
.panel { display: none; }
.panel.active { display: block; animation: fadeIn 0.15s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
.card { background: rgba(10,18,36,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(0,229,255,0.12); border-radius: 12px; padding: 20px; transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s; }
.card:hover { border-color: rgba(0,229,255,0.3); box-shadow: 0 0 24px rgba(0,229,255,0.08); transform: translateY(-2px); }
.card .label { font-size: 11px; color: #4b5e7a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.card .value { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
.card .value.green { color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.4); }
.card .value.yellow { color: #ffb800; text-shadow: 0 0 10px rgba(255,184,0,0.4); }
.card .value.red { color: #ff3366; text-shadow: 0 0 10px rgba(255,51,102,0.4); }
.card .value.blue { color: #00e5ff; text-shadow: 0 0 10px rgba(0,229,255,0.4); }
.table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #1a2540; }
table { width: 100%; border-collapse: collapse; background: rgba(10,18,36,0.6); backdrop-filter: blur(8px); min-width: 600px; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(0,229,255,0.06); font-size: 13px; }
th { background: rgba(6,10,20,0.8); color: #4b5e7a; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid rgba(0,229,255,0.15); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(0,229,255,0.03); }
.badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
.badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.badge.active { background: rgba(0,255,136,0.1); color: #00ff88; text-shadow: 0 0 6px rgba(0,255,136,0.3); }
.badge.active::before { background: #00ff88; box-shadow: 0 0 6px #00ff88; animation: pulse 2s ease-in-out infinite; }
.badge.disabled { background: rgba(255,51,102,0.1); color: #ff6688; }
.badge.disabled::before { background: #ff3366; }
.badge.rate_limited { background: rgba(255,184,0,0.1); color: #ffcc44; text-shadow: 0 0 6px rgba(255,184,0,0.3); }
.badge.rate_limited::before { background: #ffb800; animation: pulse 1.5s ease-in-out infinite; }
.badge.quota_exceeded { background: rgba(168,85,247,0.1); color: #c084fc; text-shadow: 0 0 6px rgba(168,85,247,0.3); }
.badge.quota_exceeded::before { background: #a855f7; animation: pulse 1.5s ease-in-out infinite; }
.btn { padding: 7px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; margin-right: 4px; transition: all 0.15s; }
.btn-sm { padding: 4px 8px; font-size: 12px; }
.btn-primary { background: linear-gradient(135deg, #00b8d4, #00e5ff); color: #060a14; }
.btn-primary:hover { box-shadow: 0 0 16px rgba(0,229,255,0.4); transform: translateY(-1px); }
.btn-danger { background: linear-gradient(135deg, #cc0044, #ff0066); color: #fff; }
.btn-danger:hover { box-shadow: 0 0 16px rgba(255,0,102,0.4); }
.btn-warn { background: linear-gradient(135deg, #cc8800, #ffaa00); color: #060a14; }
.btn-warn:hover { box-shadow: 0 0 16px rgba(255,170,0,0.4); }
.btn-success { background: linear-gradient(135deg, #00cc66, #00ff88); color: #060a14; }
.btn-success:hover { box-shadow: 0 0 16px rgba(0,255,136,0.4); }
.btn-info { background: linear-gradient(135deg, #0088cc, #00aaff); color: #fff; }
.btn-info:hover { box-shadow: 0 0 16px rgba(0,170,255,0.4); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.actions-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: #e2e8f0; text-shadow: 0 0 8px rgba(0,229,255,0.2); }
.section-title::before { content: ''; width: 3px; height: 16px; border-radius: 2px; background: #00e5ff; box-shadow: 0 0 6px #00e5ff; flex-shrink: 0; }
.info-bar { background: rgba(10,18,36,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(0,229,255,0.1); border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; display: flex; gap: 24px; font-size: 13px; align-items: center; flex-wrap: wrap; }
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: end; }
.filter-bar label { font-size: 12px; color: #94a3b8; display: block; margin-bottom: 2px; }
.filter-bar select, .filter-bar input { padding: 6px 10px; background: rgba(6,10,20,0.8); border: 1px solid rgba(0,229,255,0.12); border-radius: 6px; color: #e2e8f0; font-size: 13px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
.filter-bar select:focus, .filter-bar input:focus { border-color: #00e5ff; box-shadow: 0 0 0 3px rgba(0,229,255,0.08); }
.settings-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(0,229,255,0.1); }
.hint { font-size: 12px; color: #4b5e7a; margin-top: 8px; }
.dialog-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 100; align-items: center; justify-content: center; }
.dialog-overlay.show { display: flex; }
.dialog { background: rgba(10,18,36,0.9); backdrop-filter: blur(20px); border: 1px solid rgba(0,229,255,0.2); border-radius: 16px; padding: 28px; width: 460px; max-width: 92vw; max-height: 85vh; overflow-y: auto; box-shadow: 0 0 40px rgba(0,229,255,0.08), 0 24px 80px rgba(0,0,0,0.5); }
.dialog h3 { margin-bottom: 16px; font-size: 16px; color: #e2e8f0; text-shadow: 0 0 8px rgba(0,229,255,0.2); padding-bottom: 12px; border-bottom: 1px solid rgba(0,229,255,0.1); }
.dialog label { display: block; font-size: 12px; color: #4b5e7a; margin-bottom: 4px; margin-top: 14px; font-weight: 500; }
.dialog input, .dialog select { width: 100%; padding: 9px 12px; background: rgba(6,10,20,0.8); border: 1px solid rgba(0,229,255,0.12); border-radius: 8px; color: #e2e8f0; font-size: 13px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
.dialog input:focus, .dialog select:focus { border-color: #00e5ff; box-shadow: 0 0 0 3px rgba(0,229,255,0.08), 0 0 12px rgba(0,229,255,0.08); }
.dialog .btn-row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(0,229,255,0.1); }
.toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; z-index: 200; display: none; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.toast.success { background: rgba(0,255,136,0.1); color: #00ff88; border: 1px solid rgba(0,255,136,0.3); box-shadow: 0 0 20px rgba(0,255,136,0.1); display: block; }
.toast.error { background: rgba(255,0,102,0.1); color: #ff6688; border: 1px solid rgba(255,0,102,0.3); box-shadow: 0 0 20px rgba(255,0,102,0.1); display: block; }
.key-text { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 11px; color: #00e5ff; text-shadow: 0 0 4px rgba(0,229,255,0.2); word-break: break-all; }
.copy-btn { cursor: pointer; color: #00e5ff; font-size: 11px; margin-left: 6px; font-weight: 500; transition: color 0.15s; }
.copy-btn:hover { color: #80f0ff; text-shadow: 0 0 6px rgba(0,229,255,0.4); }
.empty { text-align: center; padding: 40px; color: #64748b; }
.test-result { margin-top: 12px; padding: 12px; background: rgba(6,10,20,0.8); border-radius: 6px; font-size: 13px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
.test-result.ok { border: 1px solid rgba(0,255,136,0.3); box-shadow: 0 0 8px rgba(0,255,136,0.1); }
.test-result.fail { border: 1px solid rgba(255,51,102,0.3); box-shadow: 0 0 8px rgba(255,51,102,0.1); }
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
    <button class="tab" onclick="switchTab('audit')">审计日志</button>
    <button class="tab" onclick="switchTab('settings')">设置</button>
  </div>

  <div id="panel-overview" class="panel active">
    <div class="cards" id="healthCards"></div>
  </div>

  <div id="panel-accounts" class="panel">
    <div class="actions-bar">
      <span class="section-title">API 账号管理</span>
      <button class="btn btn-primary" onclick="showAddAccount()">添加账号</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>名称</th><th>Brand</th><th>协议</th><th>API Key</th><th>Base URL</th><th>模型</th><th>状态</th><th>优先级</th><th>响应时间</th><th>成功率</th><th>连败</th><th>已用额度</th><th>最后错误</th><th>操作</th></tr></thead>
        <tbody id="accountsBody"></tbody>
      </table>
    </div>
  </div>

  <div id="panel-apikeys" class="panel">
    <div class="actions-bar">
      <span class="section-title">设备 API Key</span>
      <button class="btn btn-primary" onclick="showAddKey()">生成新 Key</button>
    </div>
    <div id="keyUrlBar" class="info-bar"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>名称</th><th>Brand</th><th>Key</th><th>状态</th><th>有效期</th><th>速率限制</th><th>Token 配额</th><th>使用统计</th><th>操作</th></tr></thead>
        <tbody id="keysBody"></tbody>
      </table>
    </div>
  </div>

  <div id="panel-usage" class="panel">
    <div class="actions-bar">
      <span class="section-title">使用日志</span>
      <button class="btn btn-primary" onclick="loadUsage()">刷新</button>
    </div>
    <div class="filter-bar">
      <div><label>模型</label><select id="usageFilterModel"><option value="">全部</option></select></div>
      <div><label>设备</label><select id="usageFilterDevice"><option value="">全部</option></select></div>
      <div><label>状态</label><select id="usageFilterStatus"><option value="">全部</option><option value="1">成功</option><option value="0">失败</option></select></div>
      <div><label>起始日期</label><input type="date" id="usageDateFrom"></div>
      <div><label>截止日期</label><input type="date" id="usageDateTo"></div>
      <button class="btn btn-primary btn-sm" onclick="loadUsage()">筛选</button>
      <button class="btn btn-sm" onclick="clearUsageFilter()">清除</button>
    </div>
    <div id="usageSummary" class="info-bar"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>时间</th><th>设备</th><th>模型</th><th>账号ID</th><th>输入</th><th>输出</th><th>耗时</th><th>状态</th></tr></thead>
        <tbody id="usageBody"></tbody>
      </table>
    </div>
    <div id="usagePager" style="display:flex;justify-content:center;gap:8px;margin-top:12px"></div>
  </div>

  <div id="panel-audit" class="panel">
    <div class="actions-bar">
      <span class="section-title">审计日志</span>
      <button class="btn btn-primary" onclick="loadAuditLogs()">刷新</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>时间</th><th>操作</th><th>类型</th><th>目标ID</th><th>详情</th></tr></thead>
        <tbody id="auditBody"></tbody>
      </table>
    </div>
  </div>

  <div id="panel-settings" class="panel">
    <div class="actions-bar">
      <span class="section-title">分组管理</span>
      <button class="btn btn-primary" onclick="loadBrands()">刷新</button>
    </div>
    <div class="filter-bar">
      <input id="newBrandName" placeholder="输入新分组名称" style="flex:1">
      <button class="btn btn-primary" onclick="doAddBrand()">添加分组</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>分组名称</th><th>操作</th></tr></thead>
        <tbody id="brandsBody"></tbody>
      </table>
    </div>
    <div class="settings-section">
      <div class="actions-bar">
        <span class="section-title">数据导入/导出</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="doExport()">导出配置</button>
        <label class="btn btn-info" style="cursor:pointer">
          导入配置
          <input type="file" accept=".json" style="display:none" onchange="doImport(event)">
        </label>
      </div>
      <p class="hint">导出为 JSON 文件（API Key 会脱敏）。导入仅支持含完整 Key 的文件，追加模式不覆盖已有数据。</p>
    </div>
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
    <select id="accBrand">
      <option value="">请选择分组</option>
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
    <select id="editAccBrand">
      <option value="">请选择分组</option>
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
    <select id="keyBrand">
      <option value="">请选择分组</option>
    </select>
    <label>有效期</label>
    <select id="keyExpiry" onchange="toggleCustomExpiry('key')">
      <option value="" selected>永久</option>
      <option value="1d">1天</option>
      <option value="7d">7天</option>
      <option value="30d">30天</option>
      <option value="365d">1年</option>
      <option value="custom">自定义</option>
    </select>
    <input type="datetime-local" id="keyExpiryCustom" style="display:none">
    <label>Token 配额（0 = 无限制）</label><input id="keyTokenQuota" type="number" value="0" placeholder="0 = 无限制">
    <label>允许模型（留空 = 不限制，逗号分隔）</label><input id="keyAllowedModels" placeholder="如: kimi-k2.5,claude-sonnet-4-6">
    <div class="btn-row">
      <button class="btn" onclick="closeDialog('addKeyDialog')">取消</button>
      <button class="btn btn-primary" onclick="doAddKey()">生成</button>
    </div>
  </div>
</div>

<div id="editKeyDialog" class="dialog-overlay">
  <div class="dialog">
    <h3>修改设备 Key</h3>
    <input type="hidden" id="editKeyId">
    <label>设备名称</label><input id="editKeyName">
    <label>速率限制（请求/分钟）</label><input id="editKeyRate" type="number">
    <label>Brand</label>
    <select id="editKeyBrand">
      <option value="">请选择分组</option>
    </select>
    <label>有效期</label>
    <select id="editKeyExpiry" onchange="toggleCustomExpiry('editKey')">
      <option value="">永久</option>
      <option value="1d">1天</option>
      <option value="7d">7天</option>
      <option value="30d">30天</option>
      <option value="365d">1年</option>
      <option value="keep">保持不变</option>
      <option value="custom">自定义</option>
    </select>
    <input type="datetime-local" id="editKeyExpiryCustom" style="display:none">
    <label>Token 配额（0 = 无限制）</label><input id="editKeyTokenQuota" type="number" value="0">
    <label>允许模型（留空 = 不限制，逗号分隔）</label><input id="editKeyAllowedModels" placeholder="如: kimi-k2.5,claude-sonnet-4-6">
    <div class="btn-row">
      <button class="btn" onclick="closeDialog('editKeyDialog')">取消</button>
      <button class="btn btn-primary" onclick="doEditKey()">保存</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
let ADMIN_KEY = ''
let refreshTimer = null
let refreshCountdown = 30

const H = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

// 有效期辅助函数
function toggleCustomExpiry(prefix) {
  const sel = document.getElementById(prefix + 'Expiry')
  const custom = document.getElementById(prefix + 'ExpiryCustom')
  custom.style.display = sel.value === 'custom' ? '' : 'none'
}

function calcExpiry(prefix) {
  const sel = document.getElementById(prefix + 'Expiry')
  const val = sel.value
  if (!val) return null
  if (val === 'custom') {
    const v = document.getElementById(prefix + 'ExpiryCustom').value
    return v ? new Date(v).toISOString() : null
  }
  const days = { '1d': 1, '7d': 7, '30d': 30, '365d': 365 }
  const d = new Date()
  d.setDate(d.getDate() + (days[val] ?? 0))
  return d.toISOString()
}

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
    const panels = ['overview', 'accounts', 'apikeys', 'usage', 'audit', 'settings']
    t.classList.toggle('active', panels[i] === name)
  })
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.getElementById('panel-' + name).classList.add('active')
  if (name === 'overview') loadHealth()
  if (name === 'accounts') loadAccounts()
  if (name === 'apikeys') loadKeys()
  if (name === 'usage') loadUsage()
  if (name === 'audit') loadAuditLogs()
  if (name === 'settings') loadBrands()
}

function loadAll() { loadHealth(); loadAccounts(); loadKeys() }

// 从 brands 表同步选项到所有 brand select
async function syncBrandList() {
  const brands = await api('GET', '/admin/brands').catch(() => [])
  window._brands = brands
  const optionHtml = '<option value="">请选择分组</option>' +
    brands.map(b => '<option value="' + H(b.name) + '">' + H(b.name) + '</option>').join('')
  for (const id of ['accBrand', 'editAccBrand', 'keyBrand', 'editKeyBrand']) {
    const sel = document.getElementById(id)
    if (!sel) continue
    const curVal = sel.value
    sel.innerHTML = optionHtml
    if (curVal && brands.some(b => b.name === curVal)) sel.value = curVal
  }
}

async function loadBrands() {
  const list = await api('GET', '/admin/brands').catch(() => [])
  window._brands = list
  if (!list.length) { document.getElementById('brandsBody').innerHTML = '<tr><td colspan="3" class="empty">暂无分组，请添加</td></tr>'; return }
  document.getElementById('brandsBody').innerHTML = list.map(b =>
    '<tr><td>' + H(b.id) + '</td><td>' + H(b.name) + '</td>' +
    '<td><button class="btn btn-danger btn-sm" onclick="delBrand(' + b.id + ')">删除</button></td></tr>'
  ).join('')
}

async function doAddBrand() {
  const input = document.getElementById('newBrandName')
  const name = input.value.trim()
  if (!name) { toast('请输入分组名称', 'error'); return }
  try {
    await api('POST', '/admin/brands', { name })
    input.value = ''
    toast('分组已添加')
    loadBrands()
    syncBrandList()
  } catch (err) {
    toast('添加失败: ' + err.message, 'error')
  }
}

async function delBrand(id) {
  if (!confirm('确定删除该分组？')) return
  await api('DELETE', '/admin/brands/' + id)
  toast('已删除')
  loadBrands()
  syncBrandList()
}

async function doExport() {
  try {
    const data = await api('GET', '/admin/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'relay-config-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('配置已导出')
  } catch (err) {
    toast('导出失败: ' + err.message, 'error')
  }
}

async function doImport(event) {
  const file = event.target.files[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const result = await api('POST', '/admin/import', data)
    toast('导入成功: 账号 ' + result.imported.accounts + ', Key ' + result.imported.keys + ', 分组 ' + result.imported.brands)
    loadAll()
    loadBrands()
  } catch (err) {
    toast('导入失败: ' + err.message, 'error')
  }
  event.target.value = ''
}

async function loadHealth() {
  const d = await api('GET', '/admin/health')
  const s = d.summary
  document.getElementById('healthCards').innerHTML =
    '<div class="card"><div class="label">总账号数</div><div class="value blue">' + H(s.total) + '</div></div>' +
    '<div class="card"><div class="label">活跃账号</div><div class="value green">' + H(s.active) + '</div></div>' +
    '<div class="card"><div class="label">限流中</div><div class="value yellow">' + H(s.rate_limited) + '</div></div>' +
    '<div class="card"><div class="label">已禁用</div><div class="value red">' + H(s.disabled + s.quota_exceeded) + '</div></div>'
}

async function loadAccounts() {
  const [list, stats] = await Promise.all([
    api('GET', '/admin/accounts'),
    api('GET', '/admin/routing-stats').catch(() => [])
  ])
  const statMap = {}
  for (const s of stats) statMap[s.id] = s
  window._accountList = list

  if (!list.length) { document.getElementById('accountsBody').innerHTML = '<tr><td colspan="15" class="empty">暂无账号</td></tr>'; return }
  document.getElementById('accountsBody').innerHTML = list.map(a => {
    const st = statMap[a.id] || {}
    const latencyColor = st.ewma_latency_ms > 3000 ? 'color:#ff3366;text-shadow:0 0 6px rgba(255,51,102,0.4)' : (st.ewma_latency_ms > 1000 ? 'color:#ffb800;text-shadow:0 0 6px rgba(255,184,0,0.4)' : 'color:#00ff88;text-shadow:0 0 6px rgba(0,255,136,0.4)')
    return '<tr><td>' + H(a.id) + '</td><td>' + H(a.name) + '</td>' +
    '<td>' + H(a.brand || '-') + '</td>' +
    '<td><span class="badge ' + H(a.protocol || 'auto') + '">' + H(a.protocol || 'auto') + '</span></td>' +
    '<td><span class="key-text">' + H(a.api_key.slice(0, 12)) + '...' + H(a.api_key.slice(-4)) + '</span></td>' +
    '<td><span class="key-text">' + H(a.base_url || '-') + '</span></td>' +
    '<td>' + H(a.models || '-') + '</td>' +
    '<td><span class="badge ' + H(a.status) + '">' + H(a.status) + '</span></td>' +
    '<td>' + H(a.priority) + '</td>' +
    '<td style="' + latencyColor + '">' + H(st.ewma_latency_ms || 0) + 'ms</td>' +
    '<td>' + H(st.failure_rate || '0.0%') + '</td>' +
    '<td>' + H(st.consecutive_failures || 0) + '</td>' +
    '<td>' + H(a.used_quota) + '</td>' +
    '<td>' + H(a.last_error || '-') + '</td>' +
    '<td>' +
      '<button class="btn btn-info btn-sm" onclick="showTestAccount(' + a.id + ')">测试</button>' +
      '<button class="btn btn-success btn-sm" onclick="fetchModels(' + a.id + ')">模型</button>' +
      '<button class="btn btn-primary btn-sm" onclick="showEditAccount(' + a.id + ')">修改</button>' +
      (a.status === 'active'
        ? '<button class="btn btn-warn btn-sm" onclick="toggleAccount(' + a.id + ')">禁用</button>'
        : '<button class="btn btn-success btn-sm" onclick="toggleAccount(' + a.id + ')">启用</button>') +
      '<button class="btn btn-danger btn-sm" onclick="delAccount(' + a.id + ')">删除</button>' +
    '</td></tr>'
  }).join('')
  syncBrandList()
}

async function loadKeys() {
  const list = await api('GET', '/admin/api-keys')
  window._keyList = list
  syncBrandList()
  const stats = await api('GET', '/admin/stats')
  const base = location.origin
  document.getElementById('keyUrlBar').innerHTML =
    '<div><span style="color:#4b5e7a">Anthropic: </span><span class="key-text">' + H(base) + '/</span></div>' +
    '<div><span style="color:#4b5e7a">OpenAI: </span><span class="key-text">' + H(base) + '/v1</span></div>'
  if (!list.length) { document.getElementById('keysBody').innerHTML = '<tr><td colspan="9" class="empty">暂无 Key</td></tr>'; return }
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
            '<span>' + H(s.model || '-') + '</span>' +
            '<span>请求 <b style="color:#e2e8f0">' + H(s.request_count) + '</b></span>' +
            '<span>输入 <b style="color:#00e5ff">' + H(s.total_input || 0) + '</b></span>' +
            '<span>输出 <b style="color:#00ff88">' + H(s.total_output || 0) + '</b></span>' +
            '<span>缓存写 <b style="color:#ffb800">' + H(s.total_cache_write || 0) + '</b></span>' +
            '<span>缓存读 <b style="color:#c084fc">' + H(s.total_cache_read || 0) + '</b></span>' +
            '<span>合计 <b style="color:#ff6688">' + H(s.total_tokens || 0) + '</b></span>' +
          '</div>'
        ).join('')
      : '<div style="font-size:12px;color:#475569">暂无使用数据</div>'
    // 计算有效期状态
    const now = new Date()
    const expDate = k.expires_at ? new Date(k.expires_at) : null
    const isExpired = expDate && expDate < now
    const expLabel = !expDate ? '永久' : (isExpired ? '<span style="color:#ff3366">已过期</span>' : '<span style="color:#00ff88">' + H(expDate.toLocaleDateString()) + '</span>')
    // Token 配额进度
    const quota = k.token_quota || 0
    const used = k.used_tokens || 0
    let quotaHtml = '<span style="color:#94a3b8">无限制</span>'
    if (quota > 0) {
      const pct = Math.min(100, Math.round(used / quota * 100))
      const barColor = pct >= 90 ? '#ff3366' : (pct >= 70 ? '#ffb800' : '#00e5ff')
      quotaHtml =
        '<div style="font-size:12px;margin-bottom:2px">' + H(used.toLocaleString()) + ' / ' + H(quota.toLocaleString()) + '</div>' +
        '<div style="background:#1a2540;border-radius:3px;height:6px;width:100px"><div style="background:' + barColor + ';box-shadow:0 0 6px ' + barColor + ';height:6px;border-radius:3px;width:' + pct + '%"></div></div>' +
        '<div style="margin-top:2px"><button class="btn btn-info btn-sm" style="font-size:11px;padding:2px 6px" onclick="resetQuota(' + k.id + ')">重置</button></div>'
    }
    return '<tr><td>' + H(k.id) + '</td><td>' + H(k.name) + '</td>' +
    '<td>' + H(k.brand || '-') + '</td>' +
    '<td><span class="key-text" id="key-' + H(k.id) + '">' + H(k.key) + '</span>' +
    '<span class="copy-btn" onclick="copyKey(' + k.id + ')">复制</span></td>' +
    '<td><span class="badge ' + (k.is_active && !isExpired ? 'active' : 'disabled') + '">' + (k.is_active ? (isExpired ? '已过期' : '启用') : '禁用') + '</span></td>' +
    '<td>' + expLabel + '</td>' +
    '<td>' + H(k.rate_limit) + '/分钟</td>' +
    '<td>' + quotaHtml + '</td>' +
    '<td>' + statsHtml + '</td>' +
    '<td>' +
      '<button class="btn btn-primary btn-sm" onclick="showEditKey(' + k.id + ')">修改</button>' +
      (k.is_active
        ? '<button class="btn btn-warn btn-sm" onclick="toggleKey(' + k.id + ')">禁用</button>'
        : '<button class="btn btn-success btn-sm" onclick="toggleKey(' + k.id + ')">启用</button>') +
      '<button class="btn btn-danger btn-sm" onclick="delKey(' + k.id + ')">删除</button>' +
    '</td></tr>'
  }).join('')
}

let usagePage = 0
const usagePageSize = 50

async function loadUsage() {
  const model = document.getElementById('usageFilterModel').value
  const device = document.getElementById('usageFilterDevice').value
  const status = document.getElementById('usageFilterStatus').value
  const dateFrom = document.getElementById('usageDateFrom').value
  const dateTo = document.getElementById('usageDateTo').value
  const params = new URLSearchParams({ limit: String(usagePageSize), offset: String(usagePage * usagePageSize) })
  if (model) params.set('model', model)
  if (device) params.set('device', device)
  if (status !== '') params.set('is_success', status)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const d = await api('GET', '/admin/usage?' + params.toString())
  const list = d.logs || []
  const total = d.total || 0
  // 汇总统计
  const successCount = list.filter(l => l.is_success).length
  const totalInput = list.reduce((s, l) => s + (l.prompt_tokens || 0), 0)
  const totalOutput = list.reduce((s, l) => s + (l.completion_tokens || 0), 0)
  document.getElementById('usageSummary').innerHTML =
    '<span>共 <b style="color:#e2e8f0">' + H(total) + '</b> 条</span>' +
    '<span>本页 <b style="color:#e2e8f0">' + list.length + '</b> 条</span>' +
    '<span>成功 <b style="color:#00ff88">' + successCount + '</b></span>' +
    '<span>失败 <b style="color:#ff3366">' + (list.length - successCount) + '</b></span>' +
    '<span>输入 <b style="color:#00e5ff">' + totalInput.toLocaleString() + '</b></span>' +
    '<span>输出 <b style="color:#00ff88">' + totalOutput.toLocaleString() + '</b></span>'
  if (!list.length) { document.getElementById('usageBody').innerHTML = '<tr><td colspan="8" class="empty">暂无日志</td></tr>'; document.getElementById('usagePager').innerHTML = ''; return }
  document.getElementById('usageBody').innerHTML = list.map(l =>
    '<tr><td>' + H(l.created_at || '-') + '</td>' +
    '<td>' + H(l.device_name || '-') + '</td>' +
    '<td>' + H(l.model || '-') + '</td>' +
    '<td>' + H(l.account_id || '-') + '</td>' +
    '<td>' + H(l.prompt_tokens || 0) + '</td>' +
    '<td>' + H(l.completion_tokens || 0) + '</td>' +
    '<td>' + H(l.duration_ms || 0) + 'ms</td>' +
    '<td><span class="badge ' + (l.is_success ? 'active' : 'disabled') + '">' + (l.is_success ? '成功' : '失败 ' + H(l.error_code || '')) + '</span></td></tr>'
  ).join('')
  // 分页
  const totalPages = Math.ceil(total / usagePageSize)
  let pagerHtml = ''
  if (usagePage > 0) pagerHtml += '<button class="btn btn-primary btn-sm" onclick="usagePage--;loadUsage()">上一页</button>'
  pagerHtml += '<span style="color:#94a3b8;font-size:13px">' + (usagePage + 1) + ' / ' + totalPages + '</span>'
  if (usagePage < totalPages - 1) pagerHtml += '<button class="btn btn-primary btn-sm" onclick="usagePage++;loadUsage()">下一页</button>'
  document.getElementById('usagePager').innerHTML = pagerHtml
  // 更新筛选下拉选项
  updateUsageFilters()
}

function clearUsageFilter() {
  document.getElementById('usageFilterModel').value = ''
  document.getElementById('usageFilterDevice').value = ''
  document.getElementById('usageFilterStatus').value = ''
  document.getElementById('usageDateFrom').value = ''
  document.getElementById('usageDateTo').value = ''
  usagePage = 0
  loadUsage()
}

async function updateUsageFilters() {
  const stats = await api('GET', '/admin/stats').catch(() => [])
  // 模型列表
  const models = [...new Set(stats.map(s => s.model).filter(Boolean))]
  const modelSel = document.getElementById('usageFilterModel')
  const curModel = modelSel.value
  modelSel.innerHTML = '<option value="">全部</option>' + models.map(m => '<option value="' + H(m) + '">' + H(m) + '</option>').join('')
  modelSel.value = curModel
  // 设备列表
  const keys = window._keyList || []
  const devices = [...new Set(keys.map(k => k.name).filter(Boolean))]
  const deviceSel = document.getElementById('usageFilterDevice')
  const curDevice = deviceSel.value
  deviceSel.innerHTML = '<option value="">全部</option>' + devices.map(d => '<option value="' + H(d) + '">' + H(d) + '</option>').join('')
  deviceSel.value = curDevice
}

async function loadAuditLogs() {
  const list = await api('GET', '/admin/audit-logs?limit=100').catch(() => [])
  if (!list.length) { document.getElementById('auditBody').innerHTML = '<tr><td colspan="5" class="empty">暂无操作记录</td></tr>'; return }
  const actionLabel = { create: '创建', update: '修改', delete: '删除', toggle: '切换状态', reset_quota: '重置配额' }
  const typeLabel = { account: '账号', api_key: 'Key', brand: '分组' }
  document.getElementById('auditBody').innerHTML = list.map(l =>
    '<tr><td>' + H(l.created_at || '-') + '</td>' +
    '<td>' + H(actionLabel[l.action] || l.action) + '</td>' +
    '<td>' + H(typeLabel[l.target_type] || l.target_type) + '</td>' +
    '<td>' + H(l.target_id || '-') + '</td>' +
    '<td>' + H(l.detail || '-') + '</td></tr>'
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
  if (!brand) { toast('请选择分组', 'error'); return }
  const priority = document.getElementById('editAccPriority').value
  if (name) body.name = name
  if (api_key) body.api_key = api_key
  if (base_url) body.base_url = base_url
  if (models !== undefined) body.models = models
  if (protocol) body.protocol = protocol
  body.brand = brand
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
      '状态: ' + H(r.status) + ' OK\\n' +
      '耗时: ' + H(r.duration_ms) + 'ms\\n' +
      '模型: ' + H(resp.model || '-') + '\\n' +
      'Token: prompt=' + H(usage.prompt_tokens || 0) + ' completion=' + H(usage.completion_tokens || 0)
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
      '状态: ' + H(r.status) + '\\n' +
      '耗时: ' + H(r.duration_ms) + 'ms\\n' +
      '错误: ' + H(errMsg)
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
  if (!brand) { toast('请选择分组', 'error'); return }
  const priority = document.getElementById('accPriority').value
  if (url) body.base_url = url
  if (models) body.models = models
  if (protocol) body.protocol = protocol
  body.brand = brand
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

async function fetchModels(id) {
  toast('正在获取模型列表...')
  try {
    const r = await api('POST', '/admin/accounts/' + id + '/models')
    if (r.ok) {
      toast('发现 ' + r.found + ' 个模型')
      loadAccounts()
    } else {
      toast('获取失败: ' + r.error, 'error')
    }
  } catch (err) {
    toast('获取失败: ' + err.message, 'error')
  }
}

async function doAddKey() {
  const name = document.getElementById('keyName').value.trim()
  if (!name) { toast('请填写设备名称', 'error'); return }
  const brand = document.getElementById('keyBrand').value
  if (!brand) { toast('请选择分组', 'error'); return }
  const rate_limit = Number(document.getElementById('keyRate').value) ?? 60
  const expires_at = calcExpiry('key')
  const token_quota = Number(document.getElementById('keyTokenQuota').value) || 0
  const allowed_models = document.getElementById('keyAllowedModels').value.trim()
  const r = await api('POST', '/admin/api-keys', { name, brand, rate_limit, expires_at, token_quota, allowed_models })
  closeDialog('addKeyDialog')
  toast('Key 已生成: ' + r.key)
  loadKeys()
  document.getElementById('keyName').value = ''
  document.getElementById('keyRate').value = '60'
  document.getElementById('keyBrand').value = ''
  document.getElementById('keyExpiry').value = ''
  document.getElementById('keyExpiryCustom').style.display = 'none'
  document.getElementById('keyTokenQuota').value = '0'
  document.getElementById('keyAllowedModels').value = ''
}

async function toggleAccount(id) { await api('POST', '/admin/accounts/' + id + '/toggle'); loadAccounts(); loadHealth() }
async function delAccount(id) { if (!confirm('确定删除？')) return; await api('DELETE', '/admin/accounts/' + id); toast('已删除'); loadAccounts(); loadHealth() }
async function toggleKey(id) { await api('POST', '/admin/api-keys/' + id + '/toggle'); loadKeys() }
async function delKey(id) { if (!confirm('确定删除？')) return; await api('DELETE', '/admin/api-keys/' + id); toast('已删除'); loadKeys() }
async function resetQuota(id) { if (!confirm('确定重置该 Key 的已用 Token？')) return; await api('POST', '/admin/api-keys/' + id + '/reset-quota'); toast('配额已重置'); loadKeys() }

function copyKey(id) {
  const el = document.getElementById('key-' + id)
  navigator.clipboard.writeText(el.textContent)
  toast('已复制到剪贴板')
}

function showEditKey(id) {
  const list = window._keyList || []
  const k = list.find(x => x.id === id)
  if (!k) return
  document.getElementById('editKeyId').value = k.id
  document.getElementById('editKeyName').value = k.name
  document.getElementById('editKeyRate').value = k.rate_limit
  document.getElementById('editKeyBrand').value = k.brand || ''
  document.getElementById('editKeyExpiry').value = 'keep'
  document.getElementById('editKeyExpiryCustom').style.display = 'none'
  document.getElementById('editKeyTokenQuota').value = k.token_quota || 0
  document.getElementById('editKeyAllowedModels').value = k.allowed_models || ''
  showDialog('editKeyDialog')
}

async function doEditKey() {
  const id = document.getElementById('editKeyId').value
  const name = document.getElementById('editKeyName').value.trim()
  const brand = document.getElementById('editKeyBrand').value
  if (!name) { toast('请填写设备名称', 'error'); return }
  if (!brand) { toast('请选择分组', 'error'); return }
  const rate_limit = Number(document.getElementById('editKeyRate').value) ?? 60
  const body = { name, rate_limit, brand }
  const expiryVal = document.getElementById('editKeyExpiry').value
  if (expiryVal !== 'keep') {
    body.expires_at = calcExpiry('editKey')
  }
  body.token_quota = Number(document.getElementById('editKeyTokenQuota').value) || 0
  body.allowed_models = document.getElementById('editKeyAllowedModels').value.trim()
  try {
    await api('PUT', '/admin/api-keys/' + id, body)
    closeDialog('editKeyDialog')
    toast('已更新')
    loadKeys()
  } catch (err) {
    toast('更新失败: ' + err.message, 'error')
  }
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
