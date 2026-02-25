/**
 * 案例与技巧 API，带 Token（管理接口用）
 */
import { fetchWithAuth } from "../contexts/AuthContext";

export interface ScenarioApi {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: string;
  disputePoint: string;
  partyA: { name: string; trait: string; background: string };
  partyB: { name: string; trait: string; background: string };
  sortOrder?: number;
  enabled?: boolean;
}

export interface SkillApi {
  id: string;
  name: string;
  category: string;
  description: string;
  howToUse: string;
  phrasings: string[];
  pitfalls: string[];
  enabled?: boolean;
}

export async function fetchScenarios(enabledOnly = true): Promise<ScenarioApi[]> {
  const res = await fetch(`/api/scenarios?enabled=${enabledOnly}`);
  if (!res.ok) throw new Error("获取案例列表失败");
  return res.json();
}

export async function fetchSkills(enabledOnly = true): Promise<SkillApi[]> {
  const res = await fetch(`/api/skills?enabled=${enabledOnly}`);
  if (!res.ok) throw new Error("获取技巧列表失败");
  return res.json();
}

export async function fetchUsers(page = 1, pageSize = 20, params?: { name?: string; role?: string }) {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (params?.name) q.set("name", params.name);
  if (params?.role) q.set("role", params.role);
  const res = await fetchWithAuth(`/api/users?${q}`);
  if (!res.ok) throw new Error("获取用户列表失败");
  return res.json();
}

export interface UserAnalytics {
  totalSessions: number;
  avgScore: number;
  growthCurve: Array<{ date: string; score: number }>;
  skillUsage: Record<string, number>;
  commonMistakes: Array<{ mistake: string; count: number }>;
  recentSessions: Array<{ id: string; scenario: string; score: number; date: string }>;
}

export async function fetchUserAnalytics(userId: string): Promise<UserAnalytics> {
  const res = await fetchWithAuth(`/api/analytics/user/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}
