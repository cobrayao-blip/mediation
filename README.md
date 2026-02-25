# 司法调解实训机

基于 AI 的司法调解培训平台：案例模拟、带教反馈、结案评估与技巧手册。支持企业员工管理、案例与技巧后台维护，大模型可配置（千问 / DeepSeek）。

## 技术栈

| 层级     | 技术 |
|----------|------|
| 前端     | React 19 + TypeScript + Vite 6 + Tailwind CSS |
| 后端     | Node.js + Express + TypeScript |
| 数据库   | **PostgreSQL** |
| ORM      | **Prisma** |
| 部署     | **Docker Compose**（PostgreSQL + 后端 + 前端 Nginx） |

## 前置要求

- **本地开发**：Node.js 20+、pnpm/npm、PostgreSQL 16（或使用 Docker 仅跑数据库）
- **一键部署**：Docker 与 Docker Compose
- **建议**：项目目录使用英文名（如 `mediation`），否则请先将文件夹重命名为英文再执行 `docker compose`。

---

## 使用 Docker Compose 部署（推荐）

1. 克隆项目后进入目录（建议使用英文目录名，如 `mediation`，避免 Docker 在中文路径下异常）：
   ```bash
   cd mediation
   ```

2. 复制环境变量示例并按需修改：
   ```bash
   cp .env.example .env
   ```
   可修改 `.env` 中的 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB`。

3. 若当前文件夹名为中文，请先关闭 Cursor，在资源管理器中把文件夹重命名为英文（如 `mediation`），再重新打开项目。

4. 启动（默认 = 开发模式，热更新）：
   ```bash
   docker compose up
   ```
   或后台运行：`docker compose up -d`  
   访问：前端 **<http://localhost:3000>**（Vite 热更新），后端 `/api` 由 Vite 代理到 4000。

5. 访问应用（开发模式）：
   - 前端：<http://localhost:3000>，改代码即生效
   - 后端健康检查：<http://localhost:3000/api/health>（经 Vite 代理）
   - 首次部署后无用户时，后端会自动创建默认管理员：**admin@mediation.local** / **admin123**（请登录后尽快修改密码）。

6. 停止并删除容器：
   ```bash
   docker compose down
   ```
   数据持久化在 `postgres_data` 卷中，如需清空数据可加 `-v`：`docker compose down -v`。

### Compose 服务说明

| 服务       | 说明（开发模式）           | 端口 |
|------------|----------------------------|------|
| `postgres` | PostgreSQL 16              | 5432 |
| `backend`  | 后端 tsx watch             | 4000 |
| `frontend` | Vite dev（HMR）            | 3000 |

### Docker 默认 = 开发模式（热更新）

当前 **`docker compose up`** 即为开发模式：挂载源码，前端 Vite、后端 tsx watch，**改代码即生效**。

- **前端**：<http://localhost:3000>（Vite HMR，`/api` 代理到后端）
- **后端**：改 `server/` 下代码自动重启
- 首次或依赖变更后可能稍慢（容器内 `npm install`），之后保存即可见效果

停止：`Ctrl+C` 或 `docker compose down`。

### 生产部署（上线时使用）

需要构建并跑生产镜像时：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

或：`npm run docker:prod`  
访问：<http://localhost>（80 端口），前端为 Nginx 静态 + 后端 node dist，无热更新。

---

## 本地开发（不用 Docker 跑前后端）

### 1. 数据库（二选一）

- **用 Docker 只跑 PostgreSQL**：
  ```bash
  docker compose up -d postgres
  ```
  再在项目根目录创建 `.env`，设置：
  ```env
  DATABASE_URL=postgresql://mediation:mediation_secret@localhost:5432/mediation
  ```

- 或本机安装 PostgreSQL，并创建同名库与用户，再在 `.env` 中配置 `DATABASE_URL`。

### 2. 后端（Prisma + Express）

```bash
cd server
npm install
cp ../.env.example .env
# 编辑 .env 中的 DATABASE_URL
npx prisma migrate deploy
npm run dev
```

后端默认运行在 <http://localhost:4000>。

### 3. 前端

在**项目根目录**：

```bash
npm install
npm run dev
```

前端默认运行在 <http://localhost:3000>。本地开发时如需请求后端，可在 Vite 中配置 proxy 将 `/api` 转发到 `http://localhost:4000`。

---

## 环境变量

| 变量 | 说明 | 默认（示例） |
|------|------|---------------------|
| `POSTGRES_USER` | PostgreSQL 用户名 | `mediation` |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | `mediation_secret` |
| `POSTGRES_DB` | PostgreSQL 数据库名 | `mediation` |
| `DATABASE_URL` | 后端连接串（本地跑 server 时用） | `postgresql://mediation:mediation_secret@localhost:5432/mediation` |
| `QWEN_API_KEY` | 通义千问 API Key（选千问时必填） | - |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（选 DeepSeek 时必填） | - |
| `JWT_SECRET` | 鉴权 JWT 密钥（生产环境必改） | - |
| `ADMIN_DEFAULT_PASSWORD` | 首次创建默认管理员时的密码（可选） | admin123 |

大模型请求经后端代理，Key 仅存服务端；前端在设置中选择「千问」或「DeepSeek」及模型名即可。

更多规划（用户管理、案例/技巧 CRUD、大模型配置）见 [docs/项目规划与技术栈.md](docs/项目规划与技术栈.md)。

---

## 项目结构（与 Docker 相关）

```
.
├── docker-compose.yml    # PostgreSQL + backend + frontend
├── Dockerfile            # 前端构建 + Nginx
├── nginx.conf            # Nginx 配置（静态 + /api 代理）
├── .env.example
├── server/               # 后端
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       └── index.ts
├── docs/
│   └── 项目规划与技术栈.md
└── ...                   # 前端源码（Vite + React）
```

## License

Private.
