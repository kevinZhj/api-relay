#!/bin/bash
set -e

APP_NAME="api-relay"
NODE_MIN_VER="20"

echo "=========================================="
echo " API Relay - 一键安装脚本"
echo "=========================================="
echo ""

# 检查 Node.js
check_node() {
  if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js"
    echo "正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi

  NODE_VER=$(node -v | sed 's/v//; s/\..*//')
  if [ "$NODE_VER" -lt "$NODE_MIN_VER" ]; then
    echo "[错误] Node.js 版本过低: $(node -v)，需要 >= v${NODE_MIN_VER}"
    exit 1
  fi

  echo "✓ Node.js $(node -v)"
}

# 检查并安装 pm2
check_pm2() {
  if ! command -v pm2 &> /dev/null; then
    echo "正在安装 pm2..."
    npm install -g pm2
  fi
  echo "✓ pm2 $(pm2 -v)"
}

# 安装项目依赖
install_deps() {
  echo ""
  echo "安装项目依赖..."
  npm install
  echo "✓ 依赖安装完成"
}

# 生成 .env 配置
setup_env() {
  echo ""
  if [ -f .env ]; then
    read -p ".env 已存在，是否覆盖? (y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
      echo "保留现有 .env"
      return
    fi
  fi

  echo "配置环境变量..."
  echo ""

  read -p "监听端口 [3000]: " PORT
  PORT=${PORT:-3000}

  read -p "监听地址 [0.0.0.0]: " HOST
  HOST=${HOST:-0.0.0.0}

  read -p "管理员密钥 [随机生成]: " ADMIN_KEY
  if [ -z "$ADMIN_KEY" ]; then
    ADMIN_KEY=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | head -c 32 | xxd -p)
  fi

  read -p "默认 API 地址 [https://api.moonshot.cn/v1]: " DEFAULT_BASE_URL
  DEFAULT_BASE_URL=${DEFAULT_BASE_URL:-https://api.moonshot.cn/v1}

  read -p "最大重试次数 [3]: " MAX_RETRY
  MAX_RETRY=${MAX_RETRY:-3}

  read -p "限流恢复时间(分钟) [30]: " RATE_LIMIT_RECOVERY_MINUTES
  RATE_LIMIT_RECOVERY_MINUTES=${RATE_LIMIT_RECOVERY_MINUTES:-30}

  cat > .env <<EOF
PORT=$PORT
HOST=$HOST
DB_PATH=./data/relay.db
ADMIN_KEY=$ADMIN_KEY
DEFAULT_BASE_URL=$DEFAULT_BASE_URL
MAX_RETRY=$MAX_RETRY
RATE_LIMIT_RECOVERY_MINUTES=$RATE_LIMIT_RECOVERY_MINUTES
EOF

  echo ""
  echo "✓ .env 已生成"
  echo "  管理员密钥: $ADMIN_KEY"
  echo "  请妥善保存此密钥"
}

# 启动服务
start_service() {
  echo ""
  echo "启动服务..."

  mkdir -p data

  pm2 delete $APP_NAME 2>/dev/null || true
  pm2 start "npx tsx src/index.ts" --name $APP_NAME

  echo ""
  echo "设置开机自启..."
  pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || true
  pm2 save

  echo ""
  echo "✓ 服务已启动"
}

# 显示状态
show_status() {
  echo ""
  echo "=========================================="
  echo " 安装完成"
  echo "=========================================="
  echo ""
  pm2 list | grep "$APP_NAME" || true
  echo ""
  echo "常用命令:"
  echo "  查看日志    pm2 logs $APP_NAME"
  echo "  重启服务    pm2 restart $APP_NAME"
  echo "  停止服务    pm2 stop $APP_NAME"
  echo "  查看状态    pm2 status"
  echo ""
}

# 主流程
check_node
check_pm2
install_deps
setup_env
start_service
show_status
