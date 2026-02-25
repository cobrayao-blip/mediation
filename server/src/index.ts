import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import {
  getSimulationResponse,
  evaluateMediation,
  generateMediationDocument,
  generateScenarioFromDescription,
  generateOpeningDialogue,
  getPublicLLMConfig,
  setLLMConfig,
  getDefaultLlm,
  setDefaultLlm,
  testLLMConnection,
  type LLMProvider,
  type ChatMessage,
} from "./llm.js";
import { authMiddleware, optionalAuthMiddleware, adminOnly, login as doLogin, hashPassword, verifyPassword } from "./auth.js";
import { ensureSeed } from "./seedData.js";

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 登录（无需 Token）
app.post("/api/auth/login", async (req, res) => {
  const { emailOrPhone, password } = req.body || {};
  if (!emailOrPhone || !password) {
    return res.status(400).json({ error: "请填写邮箱/手机和密码" });
  }
  const result = await doLogin(String(emailOrPhone).trim(), String(password));
  if (!result) {
    return res.status(401).json({ error: "邮箱/手机或密码错误" });
  }
  res.json(result);
});

// 当前用户信息（需登录）
app.get("/api/users/me", authMiddleware, async (req: express.Request & { user?: { userId: string; role: string } }, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, department: true, email: true, phone: true, role: true, status: true },
    });
    if (!user) return res.status(404).json({ error: "用户不存在" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "获取用户信息失败" });
  }
});

// 当前用户更新个人资料（仅本人可改姓名、部门、邮箱、手机）
app.patch("/api/users/me", authMiddleware, async (req: express.Request & { user?: { userId: string } }, res) => {
  try {
    const { name, department, email, phone } = req.body || {};
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name);
    if (department !== undefined) data.department = department ? String(department) : null;
    if (email !== undefined) data.email = email ? String(email) : null;
    if (phone !== undefined) data.phone = phone ? String(phone) : null;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "无有效字段可更新" });
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: { id: true, name: true, department: true, email: true, phone: true, role: true, status: true },
    });
    res.json(user);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002" ? "邮箱已存在" : "更新失败";
    res.status(500).json({ error: msg });
  }
});

// 当前用户修改密码
app.post("/api/users/me/change-password", authMiddleware, async (req: express.Request & { user?: { userId: string } }, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "当前密码和新密码必填" });
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { passwordHash: true } });
    if (!u) return res.status(404).json({ error: "用户不存在" });
    const valid = await verifyPassword(String(currentPassword), u.passwordHash);
    if (!valid) return res.status(400).json({ error: "当前密码错误" });
    const passwordHash = await hashPassword(String(newPassword));
    await prisma.user.update({ where: { id: req.user!.userId }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "修改密码失败" });
  }
});

// 当前用户的练习记录（用户中心用）
app.get("/api/users/me/practice-sessions", authMiddleware, async (req: express.Request & { user?: { userId: string } }, res) => {
  try {
    const sessions = await prisma.practiceSession.findMany({
      where: { userId: req.user!.userId },
      include: {
        scenario: { select: { id: true, title: true, category: true, difficulty: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: "获取练习记录失败" });
  }
});

// 用户列表与 CRUD（仅管理员）
app.get("/api/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = "1", pageSize = "20", name, department, role } = (req.query || {}) as Record<string, string>;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, Math.min(100, parseInt(pageSize, 10)));
    const take = Math.max(1, Math.min(100, parseInt(pageSize, 10)));
    const where: Record<string, unknown> = {};
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (department) where.department = { contains: department, mode: "insensitive" };
    if (role) where.role = role;
    const [list, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, department: true, email: true, phone: true, role: true, status: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ list, total });
  } catch (e) {
    res.status(500).json({ error: "获取用户列表失败" });
  }
});

app.post("/api/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, department, email, phone, role = "employee", password } = req.body || {};
    if (!name || !password) return res.status(400).json({ error: "姓名和密码必填" });
    const passwordHash = await hashPassword(String(password));
    const user = await prisma.user.create({
      data: {
        name: String(name),
        department: department ? String(department) : null,
        email: email ? String(email) : null,
        phone: phone ? String(phone) : null,
        role: role === "admin" ? "admin" : role === "mentor" ? "mentor" : "employee",
        passwordHash,
      },
      select: { id: true, name: true, department: true, email: true, phone: true, role: true, status: true },
    });
    res.status(201).json(user);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002" ? "邮箱已存在" : "创建用户失败";
    res.status(500).json({ error: msg });
  }
});

app.put("/api/users/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, email, phone, role, status, password } = req.body || {};
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name);
    if (department !== undefined) data.department = department ? String(department) : null;
    if (email !== undefined) data.email = email ? String(email) : null;
    if (phone !== undefined) data.phone = phone ? String(phone) : null;
    if (role !== undefined) data.role = role === "admin" ? "admin" : role === "mentor" ? "mentor" : "employee";
    if (status !== undefined) data.status = status === "disabled" ? "disabled" : "active";
    if (password) data.passwordHash = await hashPassword(String(password));
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, department: true, email: true, phone: true, role: true, status: true },
    });
    res.json(user);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return res.status(404).json({ error: "用户不存在" });
    }
    res.status(500).json({ error: "更新用户失败" });
  }
});

app.delete("/api/users/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return res.status(404).json({ error: "用户不存在" });
    }
    res.status(500).json({ error: "删除用户失败" });
  }
});

// 案例：大厅只读启用列表，管理 CRUD 需管理员
function scenarioToApi(s: { id: string; title: string; category: string; description: string; difficulty: string; disputePoint: string; partyA: unknown; partyB: unknown; sortOrder: number; enabled: boolean }) {
  return { id: s.id, title: s.title, category: s.category, description: s.description, difficulty: s.difficulty, disputePoint: s.disputePoint, partyA: s.partyA, partyB: s.partyB, sortOrder: s.sortOrder, enabled: s.enabled };
}

app.get("/api/scenarios", async (req, res) => {
  try {
    const enabled = req.query.enabled !== "false";
    const list = await prisma.scenario.findMany({
      where: enabled ? { enabled: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    res.json(list.map((s) => scenarioToApi(s)));
  } catch (e) {
    res.status(500).json({ error: "获取案例列表失败" });
  }
});

app.get("/api/scenarios/:id", async (req, res) => {
  try {
    const s = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (!s) return res.status(404).json({ error: "案例不存在" });
    res.json(scenarioToApi(s));
  } catch (e) {
    res.status(500).json({ error: "获取案例失败" });
  }
});

// AI生成案例接口
app.post("/api/scenarios/generate", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { description, provider, model } = req.body || {};
    if (!description || typeof description !== "string") {
      return res.status(400).json({ error: "请提供案例描述" });
    }
    if (!provider || (provider !== "qwen" && provider !== "deepseek")) {
      return res.status(400).json({ error: "provider must be qwen or deepseek" });
    }
    const config = await getPublicLLMConfig();
    const activeProvider = provider as LLMProvider;
    const activeModel = model || config[activeProvider]?.model || (activeProvider === "qwen" ? "qwen3-max-preview" : "deepseek-chat");
    
    const generated = await generateScenarioFromDescription(activeProvider, activeModel, description);
    res.json(generated);
  } catch (e) {
    console.error("POST /api/scenarios/generate", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "案例生成失败，请检查LLM配置" });
  }
});

app.post("/api/scenarios", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, category, description, difficulty, disputePoint, partyA, partyB, sortOrder = 0 } = req.body || {};
    if (!title || !category || !description || !disputePoint || !partyA || !partyB) {
      return res.status(400).json({ error: "缺少必填字段：title, category, description, disputePoint, partyA, partyB" });
    }
    const s = await prisma.scenario.create({
      data: {
        title: String(title),
        category: String(category),
        description: String(description),
        difficulty: String(difficulty || "入门级"),
        disputePoint: String(disputePoint),
        partyA,
        partyB,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    res.status(201).json(scenarioToApi(s));
  } catch (e) {
    res.status(500).json({ error: "创建案例失败" });
  }
});

app.put("/api/scenarios/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, category, description, difficulty, disputePoint, partyA, partyB, sortOrder, enabled } = req.body || {};
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = String(title);
    if (category !== undefined) data.category = String(category);
    if (description !== undefined) data.description = String(description);
    if (difficulty !== undefined) data.difficulty = String(difficulty);
    if (disputePoint !== undefined) data.disputePoint = String(disputePoint);
    if (partyA !== undefined) data.partyA = partyA;
    if (partyB !== undefined) data.partyB = partyB;
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder) || 0;
    if (enabled !== undefined) data.enabled = !!enabled;
    const s = await prisma.scenario.update({ where: { id: req.params.id }, data });
    res.json(scenarioToApi(s));
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") return res.status(404).json({ error: "案例不存在" });
    res.status(500).json({ error: "更新案例失败" });
  }
});

app.delete("/api/scenarios/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.scenario.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") return res.status(404).json({ error: "案例不存在" });
    res.status(500).json({ error: "删除案例失败" });
  }
});

// 技巧手册：大厅只读启用列表，管理 CRUD 需管理员
function skillToApi(s: { id: string; name: string; category: string; description: string; howToUse: string; phrasings: unknown; pitfalls: unknown; enabled: boolean }) {
  return { id: s.id, name: s.name, category: s.category, description: s.description, howToUse: s.howToUse, phrasings: s.phrasings as string[], pitfalls: s.pitfalls as string[] };
}

app.get("/api/skills", async (req, res) => {
  try {
    const enabled = req.query.enabled !== "false";
    const list = await prisma.skill.findMany({
      where: enabled ? { enabled: true } : undefined,
      orderBy: { name: "asc" },
    });
    res.json(list.map((s) => skillToApi(s)));
  } catch (e) {
    res.status(500).json({ error: "获取技巧列表失败" });
  }
});

app.get("/api/skills/:id", async (req, res) => {
  try {
    const s = await prisma.skill.findUnique({ where: { id: req.params.id } });
    if (!s) return res.status(404).json({ error: "技巧不存在" });
    res.json(skillToApi(s));
  } catch (e) {
    res.status(500).json({ error: "获取技巧失败" });
  }
});

app.post("/api/skills", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, category, description, howToUse, phrasings = [], pitfalls = [], enabled = true } = req.body || {};
    if (!name || !category || !description || !howToUse) {
      return res.status(400).json({ error: "缺少必填字段：name, category, description, howToUse" });
    }
    const s = await prisma.skill.create({
      data: {
        name: String(name),
        category: String(category),
        description: String(description),
        howToUse: String(howToUse),
        phrasings: Array.isArray(phrasings) ? phrasings : [],
        pitfalls: Array.isArray(pitfalls) ? pitfalls : [],
        enabled: !!enabled,
      },
    });
    res.status(201).json(skillToApi(s));
  } catch (e) {
    res.status(500).json({ error: "创建技巧失败" });
  }
});

app.put("/api/skills/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, category, description, howToUse, phrasings, pitfalls, enabled } = req.body || {};
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name);
    if (category !== undefined) data.category = String(category);
    if (description !== undefined) data.description = String(description);
    if (howToUse !== undefined) data.howToUse = String(howToUse);
    if (phrasings !== undefined) data.phrasings = Array.isArray(phrasings) ? phrasings : [];
    if (pitfalls !== undefined) data.pitfalls = Array.isArray(pitfalls) ? pitfalls : [];
    if (enabled !== undefined) data.enabled = !!enabled;
    const s = await prisma.skill.update({ where: { id: req.params.id }, data });
    res.json(skillToApi(s));
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") return res.status(404).json({ error: "技巧不存在" });
    res.status(500).json({ error: "更新技巧失败" });
  }
});

app.delete("/api/skills/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.skill.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") return res.status(404).json({ error: "技巧不存在" });
    res.status(500).json({ error: "删除技巧失败" });
  }
});

app.get("/api/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "connected" });
  } catch (e) {
    res.status(500).json({ status: "error", message: String(e) });
  }
});

// 大模型运行时配置（网页中手动设置，后端只返回脱敏信息，配置持久化到数据库）
app.get("/api/settings/llm", async (_req, res) => {
  try {
    const [cfg, defaultLlm] = await Promise.all([getPublicLLMConfig(), getDefaultLlm()]);
    const body = cfg as Record<string, unknown> & { defaultProvider?: string; defaultModel?: string };
    if (defaultLlm) {
      body.defaultProvider = defaultLlm.provider;
      body.defaultModel = defaultLlm.model;
    }
    res.json(body);
  } catch (e) {
    res.status(500).json({ error: "获取大模型配置失败" });
  }
});

// 查询当前设置的默认大模型（名称与 provider）
app.get("/api/settings/llm/default", async (_req, res) => {
  try {
    const defaultLlm = await getDefaultLlm();
    if (!defaultLlm) return res.json({ provider: null, model: null });
    res.json({ provider: defaultLlm.provider, model: defaultLlm.model });
  } catch (e) {
    res.status(500).json({ error: "获取默认大模型失败" });
  }
});

app.post("/api/settings/llm/default", async (req, res) => {
  try {
    const { provider, model } = req.body || {};
    if (!provider || (provider !== "qwen" && provider !== "deepseek")) {
      return res.status(400).json({ error: "provider 必须为 qwen 或 deepseek" });
    }
    if (!model || typeof model !== "string" || !model.trim()) {
      return res.status(400).json({ error: "请提供 model 名称" });
    }
    await setDefaultLlm(provider as LLMProvider, String(model).trim());
    const defaultLlm = await getDefaultLlm();
    res.json(defaultLlm ?? { provider, model: String(model).trim() });
  } catch (e) {
    res.status(500).json({ error: "设置默认大模型失败" });
  }
});

app.post("/api/settings/llm", async (req, res) => {
  try {
    const { provider, apiKey, baseUrl, model } = req.body || {};
    if (!provider || (provider !== "qwen" && provider !== "deepseek")) {
      return res.status(400).json({ error: "provider 必须为 qwen 或 deepseek" });
    }
    const updates: { apiKey?: string; baseUrl?: string; model?: string } = {};
    if (apiKey !== undefined && apiKey !== "") updates.apiKey = String(apiKey);
    if (baseUrl !== undefined && baseUrl !== "") updates.baseUrl = String(baseUrl);
    if (model !== undefined && model !== "") updates.model = String(model);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "请填写 API Key、API Base 或模型名称至少一项" });
    }
    await setLLMConfig(provider as LLMProvider, updates);
    const cfg = await getPublicLLMConfig();
    res.json(cfg);
  } catch (e) {
    console.error("POST /api/settings/llm error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: `保存大模型配置失败: ${errorMessage}` });
  }
});

app.post("/api/settings/llm/test", async (req, res) => {
  const { provider, apiKey, baseUrl, model } = req.body || {};
  if (!provider || (provider !== "qwen" && provider !== "deepseek")) {
    return res.status(400).json({ error: "provider 必须为 qwen 或 deepseek" });
  }
  try {
    await testLLMConnection(provider as LLMProvider, {
      apiKey: apiKey ? String(apiKey) : undefined,
      baseUrl: baseUrl ? String(baseUrl) : undefined,
      model: model ? String(model) : undefined,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "连接失败" });
  }
});

// 生成个性化开场对话
app.post("/api/llm/generate-opening", async (req, res) => {
  try {
    const { provider, model, scenario } = req.body;
    if (!provider || !model || !scenario) {
      return res.status(400).json({ error: "Missing provider, model or scenario" });
    }
    if (provider !== "qwen" && provider !== "deepseek") {
      return res.status(400).json({ error: "provider must be qwen or deepseek" });
    }
    const opening = await generateOpeningDialogue(
      provider as LLMProvider,
      String(model),
      scenario
    );
    res.json(opening);
  } catch (e) {
    console.error("POST /api/llm/generate-opening", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "开场对话生成失败" });
  }
});

// 大模型代理：Key 存后端，前端只传 provider + model
app.post("/api/llm/chat", async (req, res) => {
  try {
    const { provider, model, systemInstruction, scenario, history, userInput } = req.body;
    if (!provider || !model || !scenario || !Array.isArray(history) || userInput == null) {
      return res.status(400).json({ error: "Missing provider, model, scenario, history or userInput" });
    }
    if (provider !== "qwen" && provider !== "deepseek") {
      return res.status(400).json({ error: "provider must be qwen or deepseek" });
    }
    const turn = await getSimulationResponse(
      provider as LLMProvider,
      String(model),
      String(systemInstruction ?? ""),
      scenario,
      history as ChatMessage[],
      String(userInput)
    );
    res.json(turn);
  } catch (e) {
    console.error("POST /api/llm/chat", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "LLM chat failed" });
  }
});

app.post("/api/llm/evaluate", optionalAuthMiddleware, async (req, res) => {
  try {
    const { provider, model, scenarioTitle, scenarioId, chatHistory } = req.body;
    if (!provider || !model || !scenarioTitle || !Array.isArray(chatHistory)) {
      return res.status(400).json({ error: "Missing provider, model, scenarioTitle or chatHistory" });
    }
    if (provider !== "qwen" && provider !== "deepseek") {
      return res.status(400).json({ error: "provider must be qwen or deepseek" });
    }
    const result = await evaluateMediation(
      provider as LLMProvider,
      String(model),
      String(scenarioTitle),
      chatHistory as ChatMessage[]
    );
    
    // 保存练习记录（包含评估结果）
    if (req.user && scenarioId) {
      try {
        const session = await prisma.practiceSession.create({
          data: {
            userId: req.user.userId,
            scenarioId: String(scenarioId),
            messages: chatHistory as any,
            assessment: result as any,
          },
        });
        // 异步保存分析数据（不阻塞响应）
        const userId = req.user!.userId;
        const scenarioIdStr = String(scenarioId);
        setTimeout(async () => {
          try {
            const assessment = result as any;
            const stageScores: Record<string, number> = {};
            if (assessment?.stages && Array.isArray(assessment.stages)) {
              assessment.stages.forEach((s: any) => {
                if (s.completed && s.score !== undefined) {
                  stageScores[s.stage] = s.score;
                }
              });
            }
            const skillUsage: Record<string, number> = {};
            const messages = chatHistory as Array<{ recommendedSkillName?: string }>;
            messages.forEach(m => {
              if ((m as any).recommendedSkillName) {
                skillUsage[(m as any).recommendedSkillName] = (skillUsage[(m as any).recommendedSkillName] || 0) + 1;
              }
            });
            await prisma.practiceAnalytics.create({
              data: {
                sessionId: session.id,
                userId: userId,
                scenarioId: scenarioIdStr,
                totalScore: result.score || 0,
                stageScores: stageScores as any,
                skillUsage: skillUsage as any,
                practiceDate: session.createdAt,
              },
            });
          } catch (analyticsErr) {
            console.error("Failed to save analytics:", analyticsErr);
          }
        }, 100);
      } catch (dbErr) {
        console.error("Failed to save practice session:", dbErr);
        // 不阻断评估结果返回
      }
    }
    
    res.json(result);
  } catch (e) {
    console.error("POST /api/llm/evaluate", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "LLM evaluate failed" });
  }
});

app.post("/api/llm/generate-document", optionalAuthMiddleware, async (req, res) => {
  try {
    const { provider, model, scenarioTitle, partyA, partyB, chatHistory } = req.body;
    if (!provider || !model || !scenarioTitle || !partyA || !partyB || !Array.isArray(chatHistory)) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (provider !== "qwen" && provider !== "deepseek") {
      return res.status(400).json({ error: "provider must be qwen or deepseek" });
    }
    const document = await generateMediationDocument(
      provider as LLMProvider,
      String(model),
      String(scenarioTitle),
      partyA,
      partyB,
      chatHistory as ChatMessage[]
    );
    res.json({ document });
  } catch (e) {
    console.error("POST /api/llm/generate-document", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Document generation failed" });
  }
});

// 练习记录管理 API
app.get("/api/practice-sessions", authMiddleware, adminOnly, async (req, res) => {
  try {
    const sessions = await prisma.practiceSession.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        scenario: { select: { id: true, title: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // 限制返回数量
    });
    res.json(sessions);
  } catch (e) {
    console.error("GET /api/practice-sessions", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch practice sessions" });
  }
});

app.get("/api/practice-sessions/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        scenario: true,
      },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    // 只有管理员或本人可以查看
    if (req.user?.role !== "admin" && req.user?.userId !== session.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(session);
  } catch (e) {
    console.error("GET /api/practice-sessions/:sessionId", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch session" });
  }
});

// 导师评语 API
app.post("/api/practice-sessions/:sessionId/comment", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { comment } = req.body;
    if (!comment || typeof comment !== "string") {
      return res.status(400).json({ error: "Comment is required" });
    }
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // 检查 session 是否存在
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // 创建或更新评语
    const mentorComment = await prisma.mentorComment.create({
      data: {
        sessionId,
        mentorId: req.user.userId,
        comment: String(comment),
      },
      include: {
        mentor: { select: { id: true, name: true } },
      },
    });
    
    // 同时更新 session 的 mentorComment 字段（便于快速查询）
    await prisma.practiceSession.update({
      where: { id: sessionId },
      data: { mentorComment: String(comment) },
    });
    
    res.json(mentorComment);
  } catch (e) {
    console.error("POST /api/practice-sessions/:sessionId/comment", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to add comment" });
  }
});

app.get("/api/practice-sessions/:sessionId/comments", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const comments = await prisma.mentorComment.findMany({
      where: { sessionId },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(comments);
  } catch (e) {
    console.error("GET /api/practice-sessions/:sessionId/comments", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch comments" });
  }
});

// 观摩模式：导师可以查看任意学员的实时对话（通过sessionId）
app.get("/api/practice-sessions/:sessionId/observe", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // 只有管理员或导师可以观摩
    if (req.user.role !== "admin" && req.user.role !== "mentor") {
      return res.status(403).json({ error: "Only mentors and admins can observe sessions" });
    }
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        scenario: true,
      },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    // 更新观摩者列表
    const observers = (session.observers as string[]) || [];
    if (!observers.includes(req.user.userId)) {
      observers.push(req.user.userId);
      await prisma.practiceSession.update({
        where: { id: sessionId },
        data: { observers: observers, isObserved: true },
      });
    }
    res.json(session);
  } catch (e) {
    console.error("GET /api/practice-sessions/:sessionId/observe", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to observe session" });
  }
});

// 数据报表API
app.get("/api/analytics/user/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // 只能查看自己的数据，或管理员/导师可以查看任意用户
    if (req.user.userId !== userId && req.user.role !== "admin" && req.user.role !== "mentor") {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // 获取用户的练习记录
    const sessions = await prisma.practiceSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        scenario: { select: { id: true, title: true, category: true } },
        analytics: true,
      },
    });
    
    // 计算统计数据
    const totalSessions = sessions.length;
    const avgScore = sessions.length > 0
      ? sessions.reduce((sum, s) => {
          const assessment = s.assessment as { score?: number } | null;
          return sum + (assessment?.score || 0);
        }, 0) / sessions.length
      : 0;
    
    // 成长曲线数据（按日期分组）
    const growthData: Record<string, { date: string; score: number; count: number }> = {};
    sessions.forEach(s => {
      const date = new Date(s.createdAt).toISOString().split('T')[0];
      const assessment = s.assessment as { score?: number } | null;
      const score = assessment?.score || 0;
      if (!growthData[date]) {
        growthData[date] = { date, score: 0, count: 0 };
      }
      growthData[date].score += score;
      growthData[date].count += 1;
    });
    const growthCurve = Object.values(growthData)
      .map(d => ({ date: d.date, score: d.count > 0 ? Math.round(d.score / d.count) : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // 技巧使用统计
    const skillUsage: Record<string, number> = {};
    sessions.forEach(s => {
      const messages = s.messages as Array<{ recommendedSkillName?: string }>;
      messages.forEach(m => {
        if (m.recommendedSkillName) {
          skillUsage[m.recommendedSkillName] = (skillUsage[m.recommendedSkillName] || 0) + 1;
        }
      });
    });
    
    // 常见错误统计（从评估结果中提取）
    const commonMistakes: Record<string, number> = {};
    sessions.forEach(s => {
      const assessment = s.assessment as { keyAdvice?: string[] } | null;
      if (assessment?.keyAdvice) {
        assessment.keyAdvice.forEach(advice => {
          // 简单提取关键词作为错误类型
          const key = advice.substring(0, 20); // 取前20个字符作为标识
          commonMistakes[key] = (commonMistakes[key] || 0) + 1;
        });
      }
    });
    
    res.json({
      totalSessions,
      avgScore: Math.round(avgScore * 10) / 10,
      growthCurve,
      skillUsage,
      commonMistakes: Object.entries(commonMistakes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ mistake: key, count })),
      recentSessions: sessions.slice(0, 10).map(s => ({
        id: s.id,
        scenario: s.scenario.title,
        score: (s.assessment as { score?: number } | null)?.score || 0,
        date: s.createdAt,
      })),
    });
  } catch (e) {
    console.error("GET /api/analytics/user/:userId", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch analytics" });
  }
});

// 保存分析数据（在评估时自动调用）
app.post("/api/analytics/session/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const assessment = session.assessment as any;
    const stageScores: Record<string, number> = {};
    if (assessment?.stages && Array.isArray(assessment.stages)) {
      assessment.stages.forEach((s: any) => {
        if (s.completed && s.score !== undefined) {
          stageScores[s.stage] = s.score;
        }
      });
    }
    
    const skillUsage: Record<string, number> = {};
    const messages = session.messages as Array<{ recommendedSkillName?: string }>;
    messages.forEach(m => {
      if (m.recommendedSkillName) {
        skillUsage[m.recommendedSkillName] = (skillUsage[m.recommendedSkillName] || 0) + 1;
      }
    });
    
    await prisma.practiceAnalytics.create({
      data: {
        sessionId,
        userId: session.userId,
        scenarioId: session.scenarioId,
        totalScore: assessment?.score || 0,
        stageScores: stageScores as any,
        skillUsage: skillUsage as any,
        practiceDate: session.createdAt,
      },
    });
    
    res.json({ success: true });
  } catch (e) {
    console.error("POST /api/analytics/session/:sessionId", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to save analytics" });
  }
});

const PORT = Number(process.env.PORT) || 4000;

async function ensureAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return;
  const isProd = process.env.NODE_ENV === "production";
  let defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!defaultPassword) {
    if (isProd) {
      console.error("生产环境必须设置环境变量 ADMIN_DEFAULT_PASSWORD（默认管理员密码），请配置 .env 后重启");
      throw new Error("ADMIN_DEFAULT_PASSWORD is required in production");
    }
    defaultPassword = "admin123";
  }
  await prisma.user.create({
    data: {
      name: "管理员",
      email: "admin@mediation.local",
      role: "admin",
      passwordHash: await hashPassword(defaultPassword),
    },
  });
  console.log("已创建默认管理员：admin@mediation.local（请首次登录后到「用户中心」修改密码）");
}

app.listen(PORT, "0.0.0.0", async () => {
  try {
    await ensureAdmin();
    await ensureSeed();
  } catch (e) {
    console.error("Startup:", e);
  }
  console.log(`Server listening on port ${PORT}`);
});
