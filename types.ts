
export enum Difficulty {
  EASY = '入门级',
  MEDIUM = '进阶级',
  HARD = '专业级'
}

export interface Persona {
  name: string;
  trait: string;
  background: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: Difficulty;
  partyA: Persona;
  partyB: Persona;
  disputePoint: string;
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  coachTip?: string;
  recommendedSkillName?: string;
}

export interface MediationSkill {
  name: string;
  category: '沟通技巧' | '程序控制' | '谈判策略' | '法律适用';
  description: string;
  howToUse: string;
  phrasings: string[];
  pitfalls: string[];
}

export interface SimulationTurn {
  reply: string;
  coachTip: string;
  recommendedSkillName?: string;
  moodA: number;
  moodB: number;
}

export type MediationStage = '接案' | '释明' | '核实事实' | '情绪疏导' | '协议拟定' | '归档';

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
