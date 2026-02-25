#!/bin/bash
# 在腾讯云服务器上运行此脚本，一键部署司法调解实训机到 /opt/mediation
# 用法：chmod +x deploy-on-server.sh && sudo ./deploy-on-server.sh

set -e
REPO_URL="https://github.com/cobrayao-blip/mediation.git"
INSTALL_DIR="/opt/mediation"

echo "========== 1. 检查 Docker =========="
if ! command -v docker &>/dev/null; then
  echo "未检测到 Docker，请先安装。参考: docs/网站上线部署手册.md 步骤 0"
  exit 1
fi
docker --version
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi
COMPOSE_CMD="$COMPOSE -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.port8080.yml"

echo ""
echo "========== 2. 获取代码到 $INSTALL_DIR =========="
if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
  echo "项目目录已存在，拉取最新代码..."
  cd "$INSTALL_DIR" && git pull origin main || true
else
  [ -d "$INSTALL_DIR" ] && sudo rm -rf "$INSTALL_DIR"
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

echo ""
echo "========== 3. 环境变量 .env =========="
if [ ! -f .env ]; then
  cp .env.example .env
  echo "已生成 .env。请务必编辑并修改密码: nano $INSTALL_DIR/.env"
else
  echo ".env 已存在，跳过。"
fi

echo ""
echo "========== 4. 启动服务（构建+后台）=========="
$COMPOSE_CMD up -d --build

echo ""
echo "========== 5. 状态 =========="
sleep 5
$COMPOSE_CMD ps

echo ""
echo "========== 完成 =========="
echo "请配置 Nginx 并重载，然后访问 http://px.ibizsoft.cn"
echo "详见: $INSTALL_DIR/docs/网站上线部署手册.md"
