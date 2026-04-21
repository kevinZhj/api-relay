#!/bin/bash
set -e

echo "=========================================="
echo " API Relay - 大模型 API 中转站"
echo "=========================================="
echo ""

if [ ! -f .env ]; then
  echo "[错误] 未找到 .env 配置文件"
  echo "请先复制 .env.example 为 .env 并修改配置"
  echo ""
  echo "  cp .env.example .env"
  echo ""
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[错误] 未找到 node_modules"
  echo "请先安装依赖"
  echo ""
  echo "  npm install"
  echo ""
  exit 1
fi

echo "正在启动中转站..."
echo ""

npm run start
