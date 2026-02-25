/**
 * 大模型请求经后端代理，Key 存服务端；前端只传 provider + model。
 */
import { Message, Scenario, SimulationTurn, AssessmentResult } from "../types";
import { SYSTEM_INSTRUCTIONS } from "../constants";

export type LLMProvider = "qwen" | "deepseek";

const API_BASE = ""; // 相对路径，开发时走 Vite proxy，生产走 Nginx

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "请求失败");
  }
  return res.json() as Promise<T>;
}

export async function getSimulationResponse(
  provider: LLMProvider,
  model: string,
  scenario: Scenario,
  history: Message[],
  userInput: string
): Promise<SimulationTurn> {
  return post<SimulationTurn>("/llm/chat", {
    provider,
    model,
    systemInstruction: SYSTEM_INSTRUCTIONS,
    scenario: {
      title: scenario.title,
      description: scenario.description,
      partyA: scenario.partyA,
      partyB: scenario.partyB,
    },
    history: history.map((m) => ({ role: m.role, content: m.content })),
    userInput,
  });
}

export async function evaluateMediation(
  provider: LLMProvider,
  model: string,
  scenario: Scenario,
  chatHistory: Message[]
): Promise<AssessmentResult> {
  return post<AssessmentResult>("/llm/evaluate", {
    provider,
    model,
    scenarioTitle: scenario.title,
    scenarioId: scenario.id,
    chatHistory: chatHistory.map((m) => ({ role: m.role, content: m.content })),
  });
}

export async function generateMediationDocument(
  provider: LLMProvider,
  model: string,
  scenario: Scenario,
  chatHistory: Message[]
): Promise<string> {
  const res = await fetch("/api/llm/generate-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      provider,
      model,
      scenarioTitle: scenario.title,
      partyA: scenario.partyA,
      partyB: scenario.partyB,
      chatHistory: chatHistory.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || "文书生成失败");
  }
  const data = await res.json();
  return data.document || "";
}

export interface OpeningDialogue {
  openingDialogue: string;
  coachTip: string;
  recommendedSkillName: string;
  initialMoodA: number;
  initialMoodB: number;
}

export async function generateOpeningDialogue(
  provider: LLMProvider,
  model: string,
  scenario: Scenario
): Promise<OpeningDialogue> {
  return post<OpeningDialogue>("/llm/generate-opening", {
    provider,
    model,
    scenario: {
      title: scenario.title,
      description: scenario.description,
      disputePoint: scenario.disputePoint || "",
      partyA: scenario.partyA,
      partyB: scenario.partyB,
    },
  });
}
