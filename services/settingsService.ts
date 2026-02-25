import type { LLMProvider } from "./llmService";

export interface PublicLLMConfig {
  baseUrl?: string;
  hasApiKey: boolean;
  keyMasked: string | null;
  model?: string;
}

export type PublicLLMConfigResponse = Record<LLMProvider, PublicLLMConfig> & {
  defaultProvider?: LLMProvider | null;
  defaultModel?: string | null;
};

const API_BASE = "";

/** 查询当前设置的默认大模型（后端数据库） */
export async function fetchDefaultLLM(): Promise<{ provider: string; model: string } | null> {
  const res = await fetch(`${API_BASE}/api/settings/llm/default`);
  if (!res.ok) return null;
  const data = (await res.json()) as { provider: string | null; model: string | null };
  if (data.provider && data.model) return { provider: data.provider, model: data.model };
  return null;
}

export async function setDefaultLLM(provider: LLMProvider, model: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/llm/default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "设置默认大模型失败");
  }
}

export async function fetchLLMSettings(): Promise<PublicLLMConfigResponse> {
  const res = await fetch(`${API_BASE}/api/settings/llm`);
  if (!res.ok) {
    throw new Error("获取大模型配置失败");
  }
  return res.json() as Promise<PublicLLMConfigResponse>;
}

export async function updateLLMSettings(params: {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<PublicLLMConfigResponse> {
  const res = await fetch(`${API_BASE}/api/settings/llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "更新大模型配置失败");
  }
  return res.json() as Promise<PublicLLMConfigResponse>;
}

export async function testLLMSettings(params: {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/api/settings/llm/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "连接测试失败" };
  return { ok: data.ok === true, error: data.error };
}

