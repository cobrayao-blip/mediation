# 二级域名 px.ibizsoft.cn 部署说明

在同一台腾讯云服务器（122.51.67.38）上，将本项目以 **px.ibizsoft.cn** 部署，与现有 www.ibizsoft.cn 共存。

> **无部署经验？** 请直接看 **[网站上线部署手册（零基础版）](docs/网站上线部署手册.md)**，按步骤从零完成上线。

---

## 一、前置条件

- 服务器已安装 Docker、Docker Compose
- 现有主站（www.ibizsoft.cn）已由主机上的 Nginx 监听 80/443，**本项目不再占用 80 端口**
- 本项目通过 **主机 Nginx 反向代理** 到本应用（容器内 80 → 主机 8080）

---

## 二、DNS 解析

在腾讯云 DNS（或当前域名服务商）中为 **px.ibizsoft.cn** 添加记录：

| 记录类型 | 主机记录 | 记录值        | 说明     |
|----------|----------|---------------|----------|
| A        | px       | 122.51.67.38  | 公网 IP  |

若已有 `*.ibizsoft.cn` 泛解析到 122.51.67.38，可跳过此步。确认 `ping px.ibizsoft.cn` 解析到 122.51.67.38。

---

## 三、主机 Nginx 配置（反向代理）

在**宿主机**上用于主站的 Nginx 配置目录中，为 px 增加一个 server（具体路径以你当前 Nginx 为准，常见为 `/etc/nginx/conf.d/` 或 `/etc/nginx/sites-available/`）。

新建文件，例如：`/etc/nginx/conf.d/px.ibizsoft.cn.conf`：

```nginx
# px.ibizsoft.cn → 本机 8080 端口（Docker 映射）
server {
    listen 80;
    server_name px.ibizsoft.cn;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如需 HTTPS（推荐）：

1. 安装 certbot：`yum install certbot python3-certbot-nginx` 或使用腾讯云 SSL。
2. 先保证上面 HTTP 配置生效，再执行：  
   `certbot --nginx -d px.ibizsoft.cn`  
   或手动在 Nginx 里增加 `listen 443 ssl` 与 `ssl_certificate` 配置。

重载 Nginx：

```bash
sudo nginx -t && sudo nginx -s reload
```

---

## 四、本项目 Docker 生产部署（占 8080，不占 80）

在项目根目录 `mediation/` 下操作。

### 1. 环境变量（生产建议使用 .env）

```bash
cp .env.example .env   # 若无则新建 .env
```

编辑 `.env`，示例（按需修改）：

```env
POSTGRES_USER=mediation
POSTGRES_PASSWORD=你的强密码
POSTGRES_DB=mediation
JWT_SECRET=你的JWT密钥
ADMIN_DEFAULT_PASSWORD=管理员初始密码
# 若使用大模型评估，填写以下任一项
# QWEN_API_KEY=
# DEEPSEEK_API_KEY=
```

### 2. 使用“生产 + 端口 8080”配置启动

已提供 `docker-compose.port8080.yml`，将前端对外端口改为 **8080**，避免与主站 80 冲突：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.port8080.yml up -d --build
```

首次会构建镜像并启动 postgres、backend、frontend；frontend 监听 **主机 8080**，由 Nginx 将 px.ibizsoft.cn 反代到 127.0.0.1:8080。

### 3. 常用命令

```bash
# 查看状态
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.port8080.yml ps

# 查看前端/后端日志
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.port8080.yml logs -f frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.port8080.yml logs -f backend

# 停止
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.port8080.yml down
```

---

## 五、访问与检查

- 浏览器打开：`http://px.ibizsoft.cn`  
  应看到司法调解实训机前端；若已配置 HTTPS，使用 `https://px.ibizsoft.cn`。
- 默认管理员账号（若未在 seed 中修改）：邮箱/手机与 `.env` 中 `ADMIN_DEFAULT_PASSWORD` 对应（常见为 admin@mediation.local / admin123，以实际 seed 或文档为准）。

---

## 六、架构简图

```
用户 → px.ibizsoft.cn (80/443)
         ↓
    主机 Nginx（反向代理）
         ↓
    127.0.0.1:8080
         ↓
    Docker: mediation-frontend (nginx 容器 80 → 主机 8080)
         ↓ /api
    Docker: mediation-backend (4000)
         ↓
    Docker: mediation-db (PostgreSQL 5432)
```

主站 www.ibizsoft.cn 继续用原有 80/443 配置，与本项目互不占用端口。
