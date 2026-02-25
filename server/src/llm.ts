/**
 * 千问 / DeepSeek 代理：OpenAI 兼容接口，Key 存后端数据库
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type LLMProvider = "qwen" | "deepseek";

const BASE_URLS: Record<LLMProvider, string> = {
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
};

const ENV_KEYS: Record<LLMProvider, string> = {
  qwen: "QWEN_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

type LLMRuntimeConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

/** 从数据库读取配置（每个 provider 只有一条记录） */
async function getDBConfig(provider: LLMProvider): Promise<{ apiKey?: string; baseUrl?: string; modelName?: string } | null> {
  const config = await prisma.llmConfig.findUnique({
    where: { provider },
  });
  if (!config) return null;
  return {
    apiKey: config.apiKey ?? undefined,
    baseUrl: config.baseUrl ?? undefined,
    modelName: config.modelName ?? undefined,
  };
}

/** 保存配置到数据库（upsert：存在则更新，不存在则创建） */
export async function setLLMConfig(provider: LLMProvider, config: LLMRuntimeConfig): Promise<void> {
  const updates: { apiKey?: string | null; baseUrl?: string | null; modelName?: string | null } = {};
  if (config.apiKey !== undefined) updates.apiKey = config.apiKey || null;
  if (config.baseUrl !== undefined) updates.baseUrl = config.baseUrl || null;
  if (config.model !== undefined) updates.modelName = config.model || null;
  await prisma.llmConfig.upsert({
    where: { provider },
    update: updates,
    create: {
      provider,
      apiKey: config.apiKey || null,
      baseUrl: config.baseUrl || null,
      modelName: config.model || null,
      isActive: true,
    },
  });
}

const DEFAULT_LLM_PROVIDER_KEY = "default_llm_provider";
const DEFAULT_LLM_MODEL_KEY = "default_llm_model";

/** 从数据库读取当前设置的默认大模型（provider + model 名称） */
export async function getDefaultLlm(): Promise<{ provider: LLMProvider; model: string } | null> {
  const [providerRow, modelRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: DEFAULT_LLM_PROVIDER_KEY } }),
    prisma.appSetting.findUnique({ where: { key: DEFAULT_LLM_MODEL_KEY } }),
  ]);
  const provider = providerRow?.value;
  const model = modelRow?.value;
  if (provider !== "qwen" && provider !== "deepseek") return null;
  if (!model?.trim()) return null;
  return { provider: provider as LLMProvider, model: model.trim() };
}

/** 将指定 provider 和 model 设为默认大模型（写入数据库） */
export async function setDefaultLlm(provider: LLMProvider, model: string): Promise<void> {
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: DEFAULT_LLM_PROVIDER_KEY },
      update: { value: provider },
      create: { key: DEFAULT_LLM_PROVIDER_KEY, value: provider },
    }),
    prisma.appSetting.upsert({
      where: { key: DEFAULT_LLM_MODEL_KEY },
      update: { value: model },
      create: { key: DEFAULT_LLM_MODEL_KEY, value: model },
    }),
  ]);
}

async function getConfig(provider: LLMProvider): Promise<{ baseUrl: string; apiKey: string }> {
  const dbConfig = await getDBConfig(provider);
  const apiKey = dbConfig?.apiKey || process.env[ENV_KEYS[provider]] || "";
  if (!apiKey) {
    throw new Error(
      `Missing API key for ${provider}. 请在网页「大模型配置」中填写，或在后端环境变量 ${ENV_KEYS[provider]} 中配置。`
    );
  }
  const envBase = process.env[`${provider.toUpperCase()}_API_BASE`];
  const baseUrl = dbConfig?.baseUrl || envBase || BASE_URLS[provider];
  return { baseUrl, apiKey };
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  // 与前端提示保持一致，推荐使用 qwen3-max-preview
  qwen: "qwen3-max-preview",
  deepseek: "deepseek-chat",
};

/** 用指定参数取配置（用于连接测试，不写回数据库） */
async function getConfigWithOverrides(
  provider: LLMProvider,
  overrides?: { apiKey?: string; baseUrl?: string }
): Promise<{ baseUrl: string; apiKey: string }> {
  const dbConfig = await getDBConfig(provider);
  const apiKey = overrides?.apiKey ?? dbConfig?.apiKey ?? process.env[ENV_KEYS[provider]] ?? "";
  if (!apiKey) {
    throw new Error("请填写 API Key 后再测试");
  }
  const envBase = process.env[`${provider.toUpperCase()}_API_BASE`];
  const baseUrl = overrides?.baseUrl ?? dbConfig?.baseUrl ?? envBase ?? BASE_URLS[provider];
  return { baseUrl, apiKey };
}

export interface ChatMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface SimulationTurn {
  reply: string;
  coachTip: string;
  recommendedSkillName?: string;
  moodA: number;
  moodB: number;
}

export type MediationStage = "接案" | "释明" | "核实事实" | "情绪疏导" | "协议拟定" | "归档";

export interface StageProgress {
  stage: MediationStage;
  completed: boolean;
  score?: number;
  feedback?: string;
}

export interface AssessmentResult {
  score: number;
  legalAccuracy: string;
  emotionalIntelligence: string;
  procedureCompliance: string;
  keyAdvice: string[];
  stages?: StageProgress[]; // 分阶段评估结果
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "model";
  content: string;
}

// 提供给前端的脱敏配置视图（从数据库读取）
export async function getPublicLLMConfig(): Promise<Record<LLMProvider, { baseUrl?: string; hasApiKey: boolean; keyMasked: string | null; model?: string }>> {
  const result: Record<
    LLMProvider,
    { baseUrl?: string; hasApiKey: boolean; keyMasked: string | null; model?: string }
  > = {
    qwen: { baseUrl: undefined, hasApiKey: false, keyMasked: null, model: undefined },
    deepseek: { baseUrl: undefined, hasApiKey: false, keyMasked: null, model: undefined },
  };

  for (const p of ["qwen", "deepseek"] as LLMProvider[]) {
    const dbConfig = await getDBConfig(p);
    const envKey = process.env[ENV_KEYS[p]];
    const base = dbConfig?.baseUrl || process.env[`${p.toUpperCase()}_API_BASE`] || BASE_URLS[p];
    const key = dbConfig?.apiKey || envKey;
    result[p] = {
      baseUrl: base,
      hasApiKey: !!key,
      keyMasked: key ? maskKey(key) : null,
      model: dbConfig?.modelName || DEFAULT_MODELS[p],
    };
  }

  return result;
}

async function chatCompletion(
  provider: LLMProvider,
  model: string,
  messages: OpenAIMessage[],
  configOverride?: { baseUrl: string; apiKey: string }
): Promise<string> {
  const { baseUrl, apiKey } = configOverride ?? await getConfig(provider);
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim() || "";
  return content;
}

/** 连接测试：用当前或传入的 apiKey/baseUrl/model 发一条最小请求，不写回配置 */
export async function testLLMConnection(
  provider: LLMProvider,
  options?: { apiKey?: string; baseUrl?: string; model?: string }
): Promise<void> {
  const config = await getConfigWithOverrides(provider, {
    apiKey: options?.apiKey,
    baseUrl: options?.baseUrl,
  });
  const dbConfig = await getDBConfig(provider);
  const model = options?.model || dbConfig?.modelName || DEFAULT_MODELS[provider];
  await chatCompletion(
    provider,
    model,
    [{ role: "user", content: "hi" }],
    config
  );
}

/** 模拟一轮对话：返回当事人回复 + 带教建议 + 情绪值 */
export async function getSimulationResponse(
  provider: LLMProvider,
  model: string,
  systemInstruction: string,
  scenario: {
    title: string;
    description: string;
    partyA: { name: string; trait: string; background: string };
    partyB: { name: string; trait: string; background: string };
  },
  history: ChatMessage[],
  userInput: string
): Promise<SimulationTurn> {
  const historyText = history
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "调解员" : "当事人"}: ${m.content}`)
    .join("\n");
  const userContent = `
场景：${scenario.title}。
背景：${scenario.description}。
当事人A：${scenario.partyA.name}（${scenario.partyA.trait}，背景：${scenario.partyA.background}）
当事人B：${scenario.partyB.name}（${scenario.partyB.trait}，背景：${scenario.partyB.background}）

历史对话：
${historyText}

当前调解员（用户）输入：${userInput}

请严格只输出一个 JSON 对象，不要其他文字。格式：
{"reply":"当事人的直接回应（可含动作描述）","coachTip":"针对用户这一步的点评与下一步建议","recommendedSkillName":"技巧名称或留空","moodA":50,"moodB":50}
`;
  const content = await chatCompletion(provider, model, [
    { role: "system", content: systemInstruction },
    { role: "user", content: userContent },
  ]);
  try {
    const json = extractJson(content);
    return {
      reply: String(json.reply ?? "（对方陷入了沉默...）"),
      coachTip: String(json.coachTip ?? "请换一种方式继续沟通。"),
      recommendedSkillName: json.recommendedSkillName != null ? String(json.recommendedSkillName) : undefined,
      moodA: Number(json.moodA) || 50,
      moodB: Number(json.moodB) || 50,
    };
  } catch {
    return {
      reply: "（对方陷入了沉默...）",
      coachTip: "对方似乎没有听清，尝试换个更柔和的方式提问。",
      recommendedSkillName: "积极倾听 (Active Listening)",
      moodA: 50,
      moodB: 50,
    };
  }
}

/** 识别对话当前处于哪个调解阶段 */
function detectCurrentStage(chatHistory: ChatMessage[]): MediationStage {
  const historyText = chatHistory
    .filter((m) => m.role !== "system")
    .map((m) => m.content)
    .join(" ");
  const lowerText = historyText.toLowerCase();
  
  // 简单规则：根据关键词判断阶段
  if (lowerText.includes("协议") || lowerText.includes("达成") || lowerText.includes("同意") || lowerText.includes("签字")) {
    return "协议拟定";
  }
  if (lowerText.includes("归档") || lowerText.includes("结案") || lowerText.includes("完成")) {
    return "归档";
  }
  if (lowerText.includes("情绪") || lowerText.includes("安抚") || lowerText.includes("理解") || lowerText.includes("共情")) {
    return "情绪疏导";
  }
  if (lowerText.includes("事实") || lowerText.includes("证据") || lowerText.includes("核实") || lowerText.includes("确认")) {
    return "核实事实";
  }
  if (lowerText.includes("释明") || lowerText.includes("权利") || lowerText.includes("义务") || lowerText.includes("告知")) {
    return "释明";
  }
  // 默认从接案开始
  return "接案";
}

/** 根据案例信息生成个性化的开场对话 */
export async function generateOpeningDialogue(
  provider: LLMProvider,
  model: string,
  scenario: {
    title: string;
    description: string;
    disputePoint: string;
    partyA: { name: string; trait: string; background: string };
    partyB: { name: string; trait: string; background: string };
  }
): Promise<{
  openingDialogue: string;
  coachTip: string;
  recommendedSkillName: string;
  initialMoodA: number;
  initialMoodB: number;
}> {
  const userContent = `请根据以下案例信息，生成一个真实、个性化的调解开场对话。

案例标题：${scenario.title}
案例描述：${scenario.description}
争议焦点：${scenario.disputePoint}

当事人A：
- 姓名：${scenario.partyA.name}
- 性格特征：${scenario.partyA.trait}
- 背景信息：${scenario.partyA.background}

当事人B：
- 姓名：${scenario.partyB.name}
- 性格特征：${scenario.partyB.trait}
- 背景信息：${scenario.partyB.background}

要求：
1. 开场对话应该反映双方的真实情绪状态和性格特征
2. 对话内容要与争议焦点相关，体现双方的核心诉求
3. 语气和措辞要符合当事人的背景和性格（如：退休教师可能更文雅，私企中层可能更直接）
4. 可以包含动作描述，如"（双方已进入调解室，...）"
5. 对话要自然、真实，不要过于模板化

请严格只输出一个 JSON 对象，格式：
{
  "openingDialogue": "（动作描述）\\n当事人A：...\\n当事人B：...",
  "coachTip": "针对这个开场情况的带教建议",
  "recommendedSkillName": "推荐的调解技巧名称（如：积极倾听、背对背调解等）",
  "initialMoodA": 35,
  "initialMoodB": 40
}`;

  const content = await chatCompletion(provider, model, [
    { role: "user", content: userContent },
  ]);
  
  try {
    const json = extractJson(content) as {
      openingDialogue?: string;
      coachTip?: string;
      recommendedSkillName?: string;
      initialMoodA?: number;
      initialMoodB?: number;
    };
    return {
      openingDialogue: String(json.openingDialogue || `（双方已进入调解室，情绪低落）\n${scenario.partyA.name}：调解员，我今天来就是要个公道，没得商量！\n${scenario.partyB.name}：我也不是好欺负的，你要这么说干脆别调了！`),
      coachTip: String(json.coachTip || "双方对立情绪严重，尝试使用'背对背'调解法，或先安抚一方情绪。"),
      recommendedSkillName: String(json.recommendedSkillName || "背对背调解 (Caucus)"),
      initialMoodA: Number(json.initialMoodA ?? 40),
      initialMoodB: Number(json.initialMoodB ?? 40),
    };
  } catch {
    throw new Error("开场对话生成失败");
  }
}

/** 根据一句话描述生成案例 */
export async function generateScenarioFromDescription(
  provider: LLMProvider,
  model: string,
  description: string
): Promise<{
  title: string;
  category: string;
  difficulty: string;
  description: string;
  disputePoint: string;
  partyA: { name: string; trait: string; background: string };
  partyB: { name: string; trait: string; background: string };
}> {
  const userContent = `根据以下一句话描述，生成一个完整的司法调解案例。描述：${description}

请生成一个详细的调解案例，包含：
1. 标题：简洁的案例标题
2. 分类：民事纠纷、商事调解、社区治理、劳动争议等
3. 难度：入门级、进阶级、专业级
4. 描述：详细的背景描述
5. 争议焦点：双方的核心争议点
6. 当事人A：姓名、性格特征、背景信息
7. 当事人B：姓名、性格特征、背景信息

请严格只输出一个 JSON 对象，格式：
{
  "title": "案例标题",
  "category": "民事纠纷",
  "difficulty": "入门级",
  "description": "详细的背景描述...",
  "disputePoint": "争议焦点描述...",
  "partyA": {
    "name": "当事人A姓名",
    "trait": "性格特征，如：守旧、固执、爱面子",
    "background": "背景信息，如：退休教师，独居..."
  },
  "partyB": {
    "name": "当事人B姓名",
    "trait": "性格特征，如：焦躁、务实、防御性强",
    "background": "背景信息，如：私企中层，工作压力大..."
  }
}`;

  const content = await chatCompletion(provider, model, [
    { role: "user", content: userContent },
  ]);
  
  try {
    const json = extractJson(content) as {
      title?: string;
      category?: string;
      difficulty?: string;
      description?: string;
      disputePoint?: string;
      partyA?: { name?: string; trait?: string; background?: string };
      partyB?: { name?: string; trait?: string; background?: string };
    };
    return {
      title: String(json.title || ""),
      category: String(json.category || "民事纠纷"),
      difficulty: String(json.difficulty || "入门级"),
      description: String(json.description || ""),
      disputePoint: String(json.disputePoint || ""),
      partyA: {
        name: String(json.partyA?.name || "当事人A"),
        trait: String(json.partyA?.trait || ""),
        background: String(json.partyA?.background || ""),
      },
      partyB: {
        name: String(json.partyB?.name || "当事人B"),
        trait: String(json.partyB?.trait || ""),
        background: String(json.partyB?.background || ""),
      },
    };
  } catch {
    throw new Error("案例生成结果解析失败");
  }
}

/** 生成调解协议书草稿 */
export async function generateMediationDocument(
  provider: LLMProvider,
  model: string,
  scenarioTitle: string,
  partyA: { name: string },
  partyB: { name: string },
  chatHistory: ChatMessage[]
): Promise<string> {
  const historyText = chatHistory
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "调解员" : "当事人"}: ${m.content}`)
    .join("\n");
  
  const userContent = `根据以下调解对话，生成一份《调解协议书》草稿。场景：${scenarioTitle}。

当事人：
- 甲方：${partyA.name}
- 乙方：${partyB.name}

对话记录：
${historyText}

请生成一份规范的调解协议书，包含：
1. 标题：调解协议书
2. 当事人基本信息
3. 争议事项
4. 调解结果（根据对话内容推断双方达成的协议）
5. 双方权利义务
6. 履行期限和方式
7. 其他约定
8. 签字栏

如果对话中未明确达成协议，请根据对话内容合理推断可能的协议条款，并在协议中标注"（待双方确认）"。`;
  
  const content = await chatCompletion(provider, model, [
    { role: "user", content: userContent },
  ]);
  return content.trim();
}

/** 结案评估（支持分阶段评估） */
export async function evaluateMediation(
  provider: LLMProvider,
  model: string,
  scenarioTitle: string,
  chatHistory: ChatMessage[]
): Promise<AssessmentResult> {
  const historyText = chatHistory
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "调解员" : "当事人"}: ${m.content}`)
    .join("\n");
  
  // 识别各阶段
  const allStages: MediationStage[] = ["接案", "释明", "核实事实", "情绪疏导", "协议拟定", "归档"];
  const currentStage = detectCurrentStage(chatHistory);
  const currentStageIndex = allStages.indexOf(currentStage);
  
  // 构建分阶段评估提示
  const stageDescriptions = {
    接案: "开场介绍、建立信任、了解基本情况",
    释明: "告知双方权利义务、调解程序、法律依据",
    核实事实: "收集证据、确认争议焦点、澄清事实",
    情绪疏导: "安抚情绪、化解对立、建立沟通桥梁",
    协议拟定: "提出方案、协商一致、形成协议",
    归档: "整理材料、签字确认、归档结案"
  };
  
  const userContent = `分析以下调解对话，按司法调解的六个阶段给出评分和评估建议。场景：${scenarioTitle}。

对话记录：
${historyText}

请严格只输出一个 JSON 对象，不要其他文字。格式：
{
  "score": 85,
  "legalAccuracy": "法律适用方面的评价...",
  "emotionalIntelligence": "沟通策略方面的评价...",
  "procedureCompliance": "程序规范方面的评价...",
  "keyAdvice": ["建议1", "建议2", "建议3"],
  "stages": [
    {"stage": "接案", "completed": true, "score": 80, "feedback": "开场较好，但..."},
    {"stage": "释明", "completed": true, "score": 75, "feedback": "权利义务说明清晰..."},
    {"stage": "核实事实", "completed": true, "score": 85, "feedback": "事实核实充分..."},
    {"stage": "情绪疏导", "completed": true, "score": 90, "feedback": "情绪管理到位..."},
    {"stage": "协议拟定", "completed": true, "score": 88, "feedback": "协议条款合理..."},
    {"stage": "归档", "completed": false, "score": null, "feedback": "尚未完成归档阶段"}
  ]
}

说明：
- score: 1-100 的综合评分
- stages: 六个阶段的评估，completed 表示是否完成该阶段，score 为 1-100 的阶段得分（未完成可为 null），feedback 为该阶段的评价
- 当前对话已进行到 "${currentStage}" 阶段，请根据实际对话内容判断各阶段的完成情况`;
  
  const content = await chatCompletion(provider, model, [
    { role: "user", content: userContent },
  ]);
  try {
    const json = extractJson(content);
    const stages: StageProgress[] = Array.isArray(json.stages)
      ? json.stages.map((s: unknown) => {
          const stage = s as { stage?: string; completed?: boolean; score?: number | null; feedback?: string };
          return {
            stage: (stage.stage || "接案") as MediationStage,
            completed: stage.completed === true,
            score: stage.score != null ? Number(stage.score) : undefined,
            feedback: stage.feedback ? String(stage.feedback) : undefined,
          };
        })
      : [];
    
    return {
      score: Number(json.score) || 0,
      legalAccuracy: String(json.legalAccuracy ?? ""),
      emotionalIntelligence: String(json.emotionalIntelligence ?? ""),
      procedureCompliance: String(json.procedureCompliance ?? ""),
      keyAdvice: Array.isArray(json.keyAdvice) ? json.keyAdvice.map(String) : [],
      stages: stages.length > 0 ? stages : undefined,
    };
  } catch {
    // 如果解析失败，返回基础评估结果
    return {
      score: 0,
      legalAccuracy: "评估解析失败",
      emotionalIntelligence: "评估解析失败",
      procedureCompliance: "评估解析失败",
      keyAdvice: [],
    };
  }
}

function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}") + 1;
  if (start === -1 || end <= start) throw new Error("No JSON found");
  return JSON.parse(trimmed.slice(start, end)) as Record<string, unknown>;
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "*".repeat(key.length);
  const tail = key.slice(-4);
  return "****" + tail;
}
