
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SCENARIOS, SKILLS_LIBRARY } from './constants';
import { Scenario, Message, AssessmentResult, SimulationTurn, Difficulty, MediationSkill, MediationStage, StageProgress } from './types';
import { getSimulationResponse, evaluateMediation, generateMediationDocument, generateOpeningDialogue, type LLMProvider } from './services/llmService';
import { fetchLLMSettings, updateLLMSettings, testLLMSettings, setDefaultLLM, type PublicLLMConfigResponse } from './services/settingsService';
import { fetchScenarios, fetchSkills } from './services/api';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';

const IconLaw = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 13-5-5"/><path d="m3 21 3-3"/><path d="m15 13 2-2a1 1 0 0 0-1.42-1.42l-2 2"/><path d="m11 11-4-4a4 4 0 1 0-5.66 5.66l4 4a4 4 0 1 0 5.66-5.66Z"/><path d="M12 5h.01"/><path d="M16 1h.01"/><path d="M22 7h.01"/><path d="m16 23-4-4 4-4 4 4-4 4Z"/></svg>;
const IconUsers = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconSparkles = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconBook = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>;
const IconMessage = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>;
const IconAlert = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

const App: React.FC = () => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [currentStage, setCurrentStage] = useState<MediationStage>('接案');
  const [generatedDocument, setGeneratedDocument] = useState<string>('');
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [moods, setMoods] = useState({ a: 50, b: 50 });
  const [lastCoachTurn, setLastCoachTurn] = useState<{tip: string, skillName?: string} | null>(null);
  const [showSkillsLibrary, setShowSkillsLibrary] = useState(false);
  const [activeHandbookCategory, setActiveHandbookCategory] = useState<string>('全部');
  const [handbookSearch, setHandbookSearch] = useState('');
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<MediationSkill | null>(null);
  const [hoveredSkillPopover, setHoveredSkillPopover] = useState<MediationSkill | null>(null);
  const hoveredSkillPopoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('deepseek');
  const [llmModel, setLlmModel] = useState('deepseek-chat');
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false);
  const [llmApiKeyInput, setLlmApiKeyInput] = useState('');
  const [llmBaseUrlInput, setLlmBaseUrlInput] = useState('');
  const [llmModelInput, setLlmModelInput] = useState('');
  const [llmConfig, setLlmConfig] = useState<PublicLLMConfigResponse | null>(null);
  const [llmTestLoading, setLlmTestLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(SCENARIOS);
  const [skillsLibrary, setSkillsLibrary] = useState<MediationSkill[]>(SKILLS_LIBRARY);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Home Screen Case Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('全部');

  // 从本地存储恢复默认大模型（仅作首屏占位，后续由 fetchLLMSettings 按后端/配置覆盖）
  useEffect(() => {
    try {
      const storedProvider = localStorage.getItem('mediation_llm_provider');
      const storedModel = localStorage.getItem('mediation_llm_model');
      if ((storedProvider === 'qwen' || storedProvider === 'deepseek') && storedModel) {
        setLlmProvider(storedProvider as LLMProvider);
        setLlmModel(storedModel);
      }
    } catch {
      // ignore
    }
  }, []);

  // 检查当前 provider 和 model 是否已设为默认
  const isDefaultModel = useMemo(() => {
    try {
      const storedProvider = localStorage.getItem('mediation_llm_provider');
      const storedModel = localStorage.getItem('mediation_llm_model');
      const currentModel = llmModelInput || llmModel;
      return storedProvider === llmProvider && storedModel === currentModel;
    } catch {
      return false;
    }
  }, [llmProvider, llmModel, llmModelInput]);

  useEffect(() => {
    fetchScenarios(true)
      .then((list) => {
        setScenarios(list as Scenario[]);
        // 如果 URL 中有 scenarioId 参数，恢复模拟状态
        const scenarioId = searchParams.get('scenarioId');
        if (scenarioId && list.length > 0) {
          const scenario = list.find(s => s.id === scenarioId);
          if (scenario) {
            setCurrentScenario(scenario);
            // 恢复对话历史（如果有保存的话）
            const savedMessages = localStorage.getItem(`mediation_messages_${scenarioId}`);
            if (savedMessages) {
              try {
                const parsed = JSON.parse(savedMessages);
                // 将 timestamp 字符串转换回 Date 对象
                const restoredMessages = parsed.map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp)
                }));
                setMessages(restoredMessages);
                
                // 恢复情绪值
                const savedMoods = localStorage.getItem(`mediation_moods_${scenarioId}`);
                if (savedMoods) {
                  try {
                    const moods = JSON.parse(savedMoods);
                    setMoods(moods);
                  } catch {}
                }
                
                // 恢复当前阶段
                const savedStage = localStorage.getItem(`mediation_stage_${scenarioId}`);
                if (savedStage) {
                  setCurrentStage(savedStage as MediationStage);
                }
                
                // 恢复最后一条带教建议
                if (restoredMessages.length > 0) {
                  const lastModelMsg = [...restoredMessages].reverse().find((m: Message) => m.role === 'model');
                  if (lastModelMsg && lastModelMsg.coachTip) {
                    setLastCoachTurn({
                      tip: lastModelMsg.coachTip,
                      skillName: lastModelMsg.recommendedSkillName
                    });
                  }
                }
              } catch (e) {
                console.error('恢复对话历史失败:', e);
              }
            }
          }
        }
      })
      .catch(() => {});
    fetchSkills(true)
      .then((list) => setSkillsLibrary(list as MediationSkill[]))
      .catch(() => {});
  }, [searchParams]);

  const categories = useMemo(() => ['全部', ...Array.from(new Set(scenarios.map(s => s.category)))], [scenarios]);
  const skillCategories = useMemo(() => {
    const cats = Array.from(new Set(skillsLibrary.map(s => s.category))).sort();
    return ['全部', ...cats];
  }, [skillsLibrary]);

  const filteredScenarios = useMemo(() => {
    return scenarios.filter(s => {
      const matchSearch = s.title.includes(searchTerm) || s.description.includes(searchTerm);
      const matchCategory = filterCategory === '全部' || s.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [scenarios, searchTerm, filterCategory]);

  const filteredSkills = useMemo(() => {
    return skillsLibrary.filter(s => {
      const matchSearch = s.name.includes(handbookSearch) || s.description.includes(handbookSearch);
      const matchCategory = activeHandbookCategory === '全部' || s.category === activeHandbookCategory;
      return matchSearch && matchCategory;
    });
  }, [skillsLibrary, handbookSearch, activeHandbookCategory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化加载一次：拉取大模型配置；优先用后端保存的默认，否则按「谁配置了密钥」显示实际默认
  useEffect(() => {
    fetchLLMSettings()
      .then((c) => {
        setLlmConfig(c);
        const cfg = c as PublicLLMConfigResponse & { defaultProvider?: string; defaultModel?: string };
        const qwenOk = cfg.qwen?.hasApiKey && cfg.qwen?.model;
        const deepseekOk = cfg.deepseek?.hasApiKey && cfg.deepseek?.model;

        if (cfg.defaultProvider && (cfg.defaultProvider === 'qwen' || cfg.defaultProvider === 'deepseek') && cfg.defaultModel) {
          setLlmProvider(cfg.defaultProvider as LLMProvider);
          setLlmModel(cfg.defaultModel);
          try {
            localStorage.setItem('mediation_llm_provider', cfg.defaultProvider);
            localStorage.setItem('mediation_llm_model', cfg.defaultModel);
          } catch {}
          return;
        }

        // 后端未保存默认时：只配置了千问则用千问，只配置了 DeepSeek 则用 DeepSeek，避免显示未配置的 deepseek
        if (qwenOk && !deepseekOk) {
          const provider = 'qwen';
          const model = cfg.qwen!.model!;
          setLlmProvider(provider);
          setLlmModel(model);
          try {
            localStorage.setItem('mediation_llm_provider', provider);
            localStorage.setItem('mediation_llm_model', model);
          } catch {}
        } else if (deepseekOk && !qwenOk) {
          const provider = 'deepseek';
          const model = cfg.deepseek!.model!;
          setLlmProvider(provider);
          setLlmModel(model);
          try {
            localStorage.setItem('mediation_llm_provider', provider);
            localStorage.setItem('mediation_llm_model', model);
          } catch {}
        } else if (qwenOk && deepseekOk) {
          // 两个都配置了：沿用本地已存的选择，没有则用千问
          try {
            const stored = localStorage.getItem('mediation_llm_provider');
            if (stored === 'qwen' || stored === 'deepseek') {
              const p = stored as LLMProvider;
              const model = cfg[p]?.model || (p === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat');
              setLlmProvider(p);
              setLlmModel(model);
              return;
            }
          } catch {}
          setLlmProvider('qwen');
          setLlmModel(cfg.qwen!.model!);
          try {
            localStorage.setItem('mediation_llm_provider', 'qwen');
            localStorage.setItem('mediation_llm_model', cfg.qwen!.model!);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // 识别当前调解阶段（基于对话内容）
  const detectStage = (msgs: Message[]): MediationStage => {
    const text = msgs
      .filter((m) => m.role !== "system")
      .map((m) => m.content.toLowerCase())
      .join(" ");
    if (text.includes("协议") || text.includes("达成") || text.includes("同意") || text.includes("签字")) return "协议拟定";
    if (text.includes("归档") || text.includes("结案") || text.includes("完成")) return "归档";
    if (text.includes("情绪") || text.includes("安抚") || text.includes("理解") || text.includes("共情")) return "情绪疏导";
    if (text.includes("事实") || text.includes("证据") || text.includes("核实") || text.includes("确认")) return "核实事实";
    if (text.includes("释明") || text.includes("权利") || text.includes("义务") || text.includes("告知")) return "释明";
    return "接案";
  };

  const startSimulation = async (scenario: Scenario) => {
    setCurrentScenario(scenario);
    // 更新 URL 参数
    setSearchParams({ scenarioId: scenario.id });
    setCurrentStage('接案');
    setAssessment(null);
    setIsLoading(true);
    
    try {
      // 生成个性化的开场对话
      const opening = await generateOpeningDialogue(llmProvider, llmModel, scenario);
      
      const initialMoods = { a: opening.initialMoodA, b: opening.initialMoodB };
      setMoods(initialMoods);
      setLastCoachTurn({
        tip: opening.coachTip,
        skillName: opening.recommendedSkillName
      });
      const newMessages = [
      {
        role: 'system',
        content: `调解启动：${scenario.title}。${scenario.description}`,
        timestamp: new Date()
      },
      {
        role: 'model',
        content: opening.openingDialogue,
        timestamp: new Date(),
        coachTip: "双方对立情绪严重，尝试使用‘背对背’调解法，或先安抚一方情绪。",
        recommendedSkillName: "背对背调解 (Caucus)"
        }
      ];
      setMessages(newMessages);
      // 保存对话历史、情绪值、阶段到 localStorage
      localStorage.setItem(`mediation_messages_${scenario.id}`, JSON.stringify(newMessages));
      localStorage.setItem(`mediation_moods_${scenario.id}`, JSON.stringify(initialMoods));
      localStorage.setItem(`mediation_stage_${scenario.id}`, '接案');
    } catch (e) {
      console.error('生成开场对话失败:', e);
      // 如果生成失败，使用默认开场对话
      setMoods({ a: 40, b: 40 });
      setLastCoachTurn({
        tip: "请先向双方亮明身份，建立初步的信任感。",
        skillName: "积极倾听 (Active Listening)"
      });
      const defaultMoods = { a: 40, b: 40 };
      const defaultMessages = [
        {
          role: 'system' as const,
          content: `调解启动：${scenario.title}。${scenario.description}`,
          timestamp: new Date()
        },
        {
          role: 'model' as const,
          content: `（双方已进入调解室，情绪低落）\n${scenario.partyA.name}：调解员，我今天来就是要个公道，没得商量！\n${scenario.partyB.name}：我也不是好欺负的，你要这么说干脆别调了！`,
          timestamp: new Date(),
          coachTip: "双方对立情绪严重，尝试使用'背对背'调解法，或先安抚一方情绪。",
          recommendedSkillName: "背对背调解 (Caucus)"
        }
      ];
      setMessages(defaultMessages);
      // 保存对话历史、情绪值、阶段到 localStorage
      localStorage.setItem(`mediation_messages_${scenario.id}`, JSON.stringify(defaultMessages));
      localStorage.setItem(`mediation_moods_${scenario.id}`, JSON.stringify(defaultMoods));
      localStorage.setItem(`mediation_stage_${scenario.id}`, '接案');
      toast.show('开场对话生成失败，使用默认对话', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentScenario || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const turn: SimulationTurn = await getSimulationResponse(llmProvider, llmModel, currentScenario, updatedMessages, inputValue);
      const aiMsg: Message = {
        role: 'model',
        content: turn.reply,
        timestamp: new Date(),
        coachTip: turn.coachTip,
        recommendedSkillName: turn.recommendedSkillName
      };
      setMessages(prev => {
        const updated = [...prev, aiMsg];
        const newStage = detectStage(updated);
        setCurrentStage(newStage);
        // 保存对话历史、情绪值、阶段到 localStorage
        if (currentScenario) {
          localStorage.setItem(`mediation_messages_${currentScenario.id}`, JSON.stringify(updated));
          localStorage.setItem(`mediation_moods_${currentScenario.id}`, JSON.stringify({ a: turn.moodA, b: turn.moodB }));
          localStorage.setItem(`mediation_stage_${currentScenario.id}`, newStage);
        }
        return updated;
      });
      setMoods({ a: turn.moodA, b: turn.moodB });
      setLastCoachTurn({ tip: turn.coachTip, skillName: turn.recommendedSkillName });
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: 'model',
        content: "系统通讯中断...",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!currentScenario || messages.length < 3) return;
    setIsAssessing(true);
    try {
      const result = await evaluateMediation(llmProvider, llmModel, currentScenario, messages.filter(m => m.role !== 'system'));
      setAssessment(result);
    } catch (error) {
      toast.show("评估生成失败", "error");
    } finally {
      setIsAssessing(false);
    }
  };

  /** 构建调解结项分析报告 HTML（用于导出 Word/PDF） */
  const buildAssessmentReportHtml = useCallback(() => {
    if (!assessment || !currentScenario) return '';
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const stagesHtml = assessment.stages && assessment.stages.length > 0
      ? `<h3 style="margin-top:1.5em;font-size:14pt;color:#1e3a5f;">分阶段评估结果</h3>
         <table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11pt;">
         <tr style="background:#f0f9ff;"><th>阶段</th><th>得分</th><th>评价</th></tr>
         ${assessment.stages.map(s => `<tr><td>${esc(s.stage)}</td><td>${s.score ?? '-'}</td><td>${esc(s.feedback ?? '')}</td></tr>`).join('')}
         </table>`
      : '';
    const adviceHtml = assessment.keyAdvice && assessment.keyAdvice.length > 0
      ? `<h3 style="margin-top:1.5em;font-size:14pt;color:#1e3a5f;">导师结项带教</h3><ul style="font-size:11pt;line-height:1.6;">${assessment.keyAdvice.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`
      : '';
    const docHtml = generatedDocument ? `<h3 style="margin-top:1.5em;font-size:14pt;color:#0d5c36;">调解协议书</h3><div style="white-space:pre-wrap;font-size:11pt;line-height:1.6;border:1px solid #ccc;padding:12px;">${esc(generatedDocument)}</div>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>调解结项分析</title></head><body style="font-family:SimSun,serif;padding:24px;max-width:800px;margin:0 auto;">
<h1 style="font-size:18pt;color:#0f172a;">调解结项分析</h1>
<p style="color:#64748b;font-size:11pt;">案例：${esc(currentScenario.title)}</p>
<p style="font-size:12pt;">综合得分：<strong style="font-size:16pt;color:#2563eb;">${assessment.score}</strong> 分</p>
<h3 style="margin-top:1.5em;font-size:14pt;color:#1e3a5f;">法律专业性</h3>
<p style="font-size:11pt;line-height:1.6;">${esc(assessment.legalAccuracy)}</p>
<h3 style="margin-top:1em;font-size:14pt;color:#1e3a5f;">沟通策略</h3>
<p style="font-size:11pt;line-height:1.6;">${esc(assessment.emotionalIntelligence)}</p>
<h3 style="margin-top:1em;font-size:14pt;color:#1e3a5f;">实操规范</h3>
<p style="font-size:11pt;line-height:1.6;">${esc(assessment.procedureCompliance)}</p>
${stagesHtml}
${adviceHtml}
${docHtml}
<p style="margin-top:2em;font-size:10pt;color:#94a3b8;">导出时间：${new Date().toLocaleString('zh-CN')}</p>
</body></html>`;
  }, [assessment, currentScenario, generatedDocument]);

  const handleExportWord = () => {
    const html = buildAssessmentReportHtml();
    if (!html) return;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `调解结项分析_${currentScenario?.title ?? '报告'}_${new Date().toISOString().split('T')[0]}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('已导出 Word 文档', 'success');
  };

  const handleExportPdf = () => {
    const html = buildAssessmentReportHtml();
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) {
      toast.show('请允许弹窗后重试', 'error');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.document.title = '调解结项分析';
    w.setTimeout(() => { w.print(); w.close(); }, 300);
    toast.show('请在打印对话框中选择「另存为 PDF」', 'success');
  };

  const MoodBar = ({ name, value, color }: { name: string, value: number, color: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
        <span>{name}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-1000`} 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );

  // 统一归一化：忽略大小写、去掉中英文括号和多余空白，仅保留第一个关键短语
  const normalizeSkillKey = (raw: string): string => {
    if (!raw) return "";
    const cleaned = raw
      .replace(/[（）()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!cleaned) return "";
    const first = cleaned.split(/[、，,/|]/)[0]?.trim() ?? "";
    return first;
  };

  // 为技巧手册构建一个“别名 → 技巧”索引，支持中文名 / 括号内英文名 等多种写法
  const skillAliasIndex = useMemo(() => {
    const map = new Map<string, MediationSkill>();
    skillsLibrary.forEach((skill) => {
      const full = normalizeSkillKey(skill.name);
      if (full) map.set(full, skill);
      const parenMatch = skill.name.match(/[(（]([^()（）]+)[)）]/);
      if (parenMatch && parenMatch[1]) {
        const inner = normalizeSkillKey(parenMatch[1]);
        if (inner && !map.has(inner)) {
          map.set(inner, skill);
        }
      }
    });
    return map;
  }, [skillsLibrary]);

  const recommendedSkill = useMemo(() => {
    if (!lastCoachTurn?.skillName) return null;
    const key = normalizeSkillKey(lastCoachTurn.skillName);
    if (!key) return null;
    return skillAliasIndex.get(key) ?? null;
  }, [lastCoachTurn, skillAliasIndex]);

  useEffect(() => () => {
    if (hoveredSkillPopoverTimeoutRef.current) {
      clearTimeout(hoveredSkillPopoverTimeoutRef.current);
      hoveredSkillPopoverTimeoutRef.current = null;
    }
  }, []);

  const HandbookOverlay = () => {
    const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
    
    const toggleSkill = (skillName: string) => {
      setExpandedSkills(prev => {
        const next = new Set(prev);
        if (next.has(skillName)) {
          next.delete(skillName);
        } else {
          next.add(skillName);
        }
        return next;
      });
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity" onClick={() => setShowSkillsLibrary(false)} />
        <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <IconBook />
              </div>
              <div>
                <h2 className="text-2xl font-black">调解实务技巧手册</h2>
                <p className="text-sm text-blue-100 font-medium mt-0.5">共 {filteredSkills.length} 个技巧</p>
              </div>
            </div>
            <button 
              onClick={() => setShowSkillsLibrary(false)} 
              className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
              aria-label="关闭"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Search and Filter Bar */}
          <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </div>
              <input 
                type="text" 
                placeholder="搜索技巧名称、描述或关键词..." 
                value={handbookSearch}
                onChange={(e) => setHandbookSearch(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm"
              />
            </div>
            
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {skillCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveHandbookCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    activeHandbookCategory === cat 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Skills Grid */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
            {filteredSkills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSkills.map(skill => {
                  const isExpanded = expandedSkills.has(skill.name);
                  return (
                    <div 
                      key={skill.name}
                      className={`bg-white rounded-2xl border-2 transition-all cursor-pointer ${
                        isExpanded 
                          ? 'border-blue-500 shadow-xl shadow-blue-100' 
                          : 'border-slate-200 hover:border-blue-300 hover:shadow-lg'
                      }`}
                      onClick={() => toggleSkill(skill.name)}
                    >
                      {/* Card Header */}
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                            skill.category === '沟通技巧' ? 'bg-blue-50 text-blue-700' :
                            skill.category === '程序控制' ? 'bg-purple-50 text-purple-700' :
                            skill.category === '谈判策略' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {skill.category}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSkill(skill.name);
                            }}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                              className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6"/>
                            </svg>
                          </button>
                        </div>
                        <h3 className="text-base font-black text-slate-900 mb-2 leading-tight">{skill.name}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {skill.description}
                        </p>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4 animate-in slide-in-from-top duration-200">
                          {/* 核心指南 */}
                          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <h4 className="text-[10px] font-black text-blue-700 uppercase mb-2 flex items-center gap-2">
                              <IconSparkles className="w-3 h-3" /> 核心指南
                            </h4>
                            <p className="text-xs text-blue-900 leading-relaxed font-medium">
                              {skill.howToUse}
                            </p>
                          </div>

                          {/* 推荐话术 */}
                          <div>
                            <h4 className="text-[10px] font-black text-emerald-700 uppercase mb-2 flex items-center gap-2">
                              <IconMessage className="w-3 h-3" /> 推荐话术
                            </h4>
                            <ul className="space-y-2">
                              {skill.phrasings.map((p, i) => (
                                <li key={i} className="text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2.5 leading-relaxed border border-emerald-100">
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* 常见误区 */}
                          <div>
                            <h4 className="text-[10px] font-black text-rose-700 uppercase mb-2 flex items-center gap-2">
                              <IconAlert className="w-3 h-3" /> 常见误区
                            </h4>
                            <ul className="space-y-2">
                              {skill.pitfalls.map((p, i) => (
                                <li key={i} className="text-xs text-rose-800 bg-rose-50 rounded-lg p-2.5 leading-relaxed border border-rose-100">
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <IconSearch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400 font-black text-sm uppercase tracking-widest">未找到相关技巧</p>
                <p className="text-xs text-slate-400 mt-2">请尝试其他关键词或分类</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!currentScenario) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-8 md:px-12">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
                  <IconLaw />
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">司法调解实训机</h1>
              </div>
              <p className="text-slate-500 font-medium">新人带教平台 · 沉浸式案件模拟 · 实战技巧库</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">大模型</span>
                <span className="text-xs font-bold text-slate-700">
                  {llmProvider === 'qwen' ? '千问（通义）' : 'DeepSeek'} / {llmModel}
                </span>
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="模型名"
                  className="w-32 bg-slate-50 border-0 rounded-xl py-2 px-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-200"
                  title="如 deepseek-chat、qwen-plus"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  setLlmSettingsOpen(true);
                  // 获取最新配置并填充输入框
                  try {
                    const c = await fetchLLMSettings();
                    setLlmConfig(c);
                    const conf = c[llmProvider];
                    if (conf?.model) setLlmModelInput(conf.model);
                    else setLlmModelInput(llmProvider === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat');
                    // Base URL 和 API Key 不填充（后端不返回明文 key，baseUrl 显示在下方提示中）
                    setLlmBaseUrlInput('');
                    setLlmApiKeyInput('');
                  } catch {
                    // 如果获取失败，至少用当前状态填充
                    setLlmModelInput(llmModel);
                    setLlmBaseUrlInput('');
                    setLlmApiKeyInput('');
                  }
                }}
                className="px-4 py-2 rounded-2xl text-[11px] font-black border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 transition-colors"
                aria-label="配置大模型 API 密钥"
              >
                配置密钥
              </button>
              <button
                onClick={() => setShowSkillsLibrary(true)}
                className="bg-white border-2 border-slate-900 px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black text-slate-900 hover:bg-slate-900 hover:text-white transition-all shadow-md active:scale-95"
              >
                <IconBook /> 查阅技巧手册
              </button>
              <div className="flex items-center gap-3">
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-colors"
                  >
                    管理后台
                  </Link>
                )}
                <Link
                  to="/user"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-colors"
                >
                  用户中心
                </Link>
                {user && <span className="text-sm font-bold text-slate-600">{user.name}</span>}
                <button
                  onClick={logout}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-colors"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto w-full p-6 md:p-12 space-y-10 flex-1">
          <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col lg:flex-row items-center gap-6">
            <div className="relative flex-1 w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </div>
              <input 
                type="text" 
                placeholder="搜索案例标题、争议焦点或关键词..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      filterCategory === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredScenarios.map(scenario => (
              <div 
                key={scenario.id} 
                className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-2 group cursor-pointer flex flex-col"
                onClick={() => startSimulation(scenario)}
              >
                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest border border-blue-100">
                      {scenario.category}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${
                      scenario.difficulty === '入门级' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      scenario.difficulty === '进阶级' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {scenario.difficulty}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-4 group-hover:text-blue-600 transition-colors leading-tight">
                    {scenario.title}
                  </h3>
                  <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">争议焦点</p>
                    <p className="text-xs text-slate-600 font-bold leading-relaxed line-clamp-2">{scenario.disputePoint}</p>
                  </div>
                </div>
                <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center group-hover:bg-blue-600 transition-colors duration-300">
                  <span className="text-sm font-black text-slate-700 group-hover:text-white transition-colors">开启带教模拟</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-white transition-all"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
              </div>
            ))}
          </div>
        </main>
        {showSkillsLibrary && <HandbookOverlay />}
        {llmSettingsOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" role="dialog" aria-modal="true" aria-labelledby="llm-settings-title" onClick={() => setLlmSettingsOpen(false)}>
            <form
              autoComplete="off"
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => e.preventDefault()}
            >
              {/* 防止浏览器自动填充用户名/密码 */}
              <input type="text" name="fake-username" autoComplete="username" className="hidden" />
              <input type="password" name="fake-password" autoComplete="new-password" className="hidden" />
              <div className="flex justify-between items-center">
                <h3 id="llm-settings-title" className="text-sm font-black text-slate-900">大模型密钥配置</h3>
                <button type="button" onClick={() => setLlmSettingsOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400" aria-label="关闭">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">密钥仅存后端，前端不保存明文。再次打开可查看脱敏尾号。</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">提供商</span>
                    <select
                      value={llmProvider}
                      onChange={(e) => {
                        const p = e.target.value as LLMProvider;
                        setLlmProvider(p);
                        const conf = llmConfig?.[p];
                        setLlmModelInput(conf?.model ?? (p === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat'));
                        setLlmBaseUrlInput('');
                        setLlmApiKeyInput('');
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="deepseek">DeepSeek</option>
                      <option value="qwen">千问（通义）</option>
                    </select>
                  </div>
                  {isDefaultModel ? (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      已设为默认
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                      onClick={async () => {
                        const modelToUse = llmModelInput || llmModel;
                        if (!modelToUse) {
                          toast.show('请先填写或选择模型名称', 'error');
                          return;
                        }
                        try {
                          await setDefaultLLM(llmProvider, modelToUse);
                          localStorage.setItem('mediation_llm_provider', llmProvider);
                          localStorage.setItem('mediation_llm_model', modelToUse);
                          setLlmModel(modelToUse);
                          toast.show('已设为默认模型', 'success');
                        } catch (e) {
                          toast.show((e instanceof Error ? e.message : '设置失败') || '无法保存默认设置', 'error');
                        }
                      }}
                    >
                      设为默认
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">模型名称</label>
                  <input
                    type="text"
                    name="llm-model"
                    autoComplete="off"
                    value={llmModelInput}
                    onChange={(e) => setLlmModelInput(e.target.value)}
                    placeholder={llmProvider === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">API Base（可选）</label>
                  <input
                    type="text"
                    name="llm-base"
                    autoComplete="off"
                    value={llmBaseUrlInput}
                    onChange={(e) => setLlmBaseUrlInput(e.target.value)}
                    placeholder="留空则使用官方默认"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {llmConfig?.[llmProvider]?.baseUrl && <p className="text-[10px] text-slate-400">已配置：{llmConfig[llmProvider].baseUrl}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">API Key</label>
                  <input
                    type="password"
                    name="llm-api-key"
                    autoComplete="new-password"
                    value={llmApiKeyInput}
                    onChange={(e) => setLlmApiKeyInput(e.target.value)}
                    placeholder="请输入 API Key"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {llmConfig?.[llmProvider]?.hasApiKey && llmConfig[llmProvider].keyMasked && <p className="text-[10px] text-slate-400">已保存：{llmConfig[llmProvider].keyMasked}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  disabled={llmTestLoading}
                  onClick={async () => {
                    setLlmTestLoading(true);
                    try {
                      const r = await testLLMSettings({
                        provider: llmProvider,
                        apiKey: llmApiKeyInput || undefined,
                        baseUrl: llmBaseUrlInput || undefined,
                        model: llmModelInput || undefined,
                      });
                      if (r.ok) toast.show('连接成功', 'success');
                      else toast.show(r.error || '连接失败', 'error');
                    } catch (e) {
                      toast.show('连接失败', 'error');
                    } finally {
                      setLlmTestLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl text-[11px] font-black border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  连接测试
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const updated = await updateLLMSettings({
                        provider: llmProvider,
                        apiKey: llmApiKeyInput || undefined,
                        baseUrl: llmBaseUrlInput || undefined,
                        model: llmModelInput || undefined,
                      });
                      setLlmConfig(updated);
                      if (llmModelInput) setLlmModel(llmModelInput);
                      toast.show('已保存', 'success');
                    } catch (e) {
                      console.error(e);
                      toast.show('保存失败，请检查网络或后端', 'error');
                    }
                  }}
                  className="px-5 py-2 rounded-xl text-[11px] font-black bg-slate-900 text-white hover:bg-black"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => {
            const scenarioId = currentScenario?.id;
            setCurrentScenario(null);
            setMessages([]);
            setAssessment(null);
            setSearchParams({});
            if (scenarioId) {
              localStorage.removeItem(`mediation_messages_${scenarioId}`);
              localStorage.removeItem(`mediation_moods_${scenarioId}`);
              localStorage.removeItem(`mediation_stage_${scenarioId}`);
            }
          }} className="p-2 hover:bg-slate-100 rounded-full transition-colors" aria-label="返回大厅">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h2 className="font-black text-slate-800 tracking-tight">{currentScenario.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">实战模拟</span>
              <span className="text-[10px] text-slate-400 font-medium">难度：{currentScenario.difficulty}</span>
              <span className="text-[10px] text-slate-400 font-medium">模型：{llmProvider}/{llmModel}</span>
            </div>
            {/* 调解阶段进度条 */}
            <div className="flex items-center gap-1 mt-2">
              {(['接案', '释明', '核实事实', '情绪疏导', '协议拟定', '归档'] as MediationStage[]).map((stage, idx) => {
                const stageIndex = ['接案', '释明', '核实事实', '情绪疏导', '协议拟定', '归档'].indexOf(currentStage);
                const isActive = idx === stageIndex;
                const isCompleted = idx < stageIndex;
                return (
                  <React.Fragment key={stage}>
                    <div
                      className={`px-2 py-0.5 rounded text-[9px] font-black transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md scale-105'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                      title={stage}
                    >
                      {stage}
                    </div>
                    {idx < 5 && (
                      <div
                        className={`h-0.5 w-3 transition-all ${
                          isCompleted ? 'bg-emerald-300' : isActive ? 'bg-blue-300' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden xl:flex items-center gap-8 px-6 py-2 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-36"><MoodBar name={currentScenario.partyA.name} value={moods.a} color="bg-blue-600" /></div>
              <div className="w-36"><MoodBar name={currentScenario.partyB.name} value={moods.b} color="bg-rose-500" /></div>
           </div>
          <button onClick={handleFinish} disabled={messages.length < 3 || isAssessing} className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95" aria-label="申请评估结案">
            {isAssessing ? '正在汇总分析...' : '申请评估结案'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 flex flex-col bg-white overflow-hidden relative border-r border-slate-200">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'system' ? (
                  <div className="w-full bg-slate-50 border-y border-slate-200 py-4 px-6 text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] md:max-w-[75%]">
                    <div className={`rounded-3xl p-5 shadow-sm transition-all ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none ring-8 ring-blue-50 shadow-blue-100' 
                        : 'bg-slate-50 text-slate-800 rounded-bl-none border border-slate-100'
                    }`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                         {msg.content}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 rounded-bl-none shadow-sm animate-pulse flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">对方正在输入中...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <footer className="p-6 border-t border-slate-100 bg-white relative">
            <div className="max-w-4xl mx-auto space-y-4">
              {lastCoachTurn && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-3xl flex flex-col md:flex-row items-start md:items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="bg-white p-2 rounded-xl border border-amber-200 shadow-sm"><IconSparkles /></div>
                    <div className="text-[13px] text-amber-900 leading-relaxed font-bold">
                      <span className="block text-amber-600 font-black uppercase tracking-tighter mb-0.5">带教建议：</span>
                      {lastCoachTurn.tip}
                    </div>
                  </div>
                  {recommendedSkill && (
                    <div
                      className="relative flex-shrink-0"
                      onMouseEnter={() => {
                        if (hoveredSkillPopoverTimeoutRef.current) {
                          clearTimeout(hoveredSkillPopoverTimeoutRef.current);
                          hoveredSkillPopoverTimeoutRef.current = null;
                        }
                        setHoveredSkillPopover(recommendedSkill);
                      }}
                      onMouseLeave={() => {
                        hoveredSkillPopoverTimeoutRef.current = setTimeout(() => {
                          hoveredSkillPopoverTimeoutRef.current = null;
                          setHoveredSkillPopover(null);
                        }, 180);
                      }}
                    >
                      <button 
                        onClick={() => {
                          setSelectedSkillDetail(recommendedSkill);
                          setShowSkillsLibrary(true);
                        }}
                        className="bg-white border-2 border-amber-200 px-4 py-2.5 rounded-2xl text-[10px] font-black text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <IconBook /> 详解：{recommendedSkill.name}
                      </button>
                      {hoveredSkillPopover && hoveredSkillPopover.name === recommendedSkill.name && (
                        <div
                          className="absolute right-0 bottom-full mb-1 w-[340px] max-h-[320px] overflow-y-auto rounded-2xl border-2 border-amber-200 bg-white p-4 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
                          style={{ marginBottom: 4 }}
                        >
                          <h4 className="text-sm font-black text-amber-800 border-b border-amber-100 pb-2 mb-2">{hoveredSkillPopover.name}</h4>
                          <p className="text-sm text-slate-600 leading-relaxed mb-2">{hoveredSkillPopover.description}</p>
                          <p className="text-sm text-amber-900 font-medium leading-relaxed">
                            <span className="text-amber-600 font-black">如何运用：</span> {hoveredSkillPopover.howToUse}
                          </p>
                          {Array.isArray(hoveredSkillPopover.phrasings) && hoveredSkillPopover.phrasings.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-amber-50">
                              <span className="text-xs font-black text-amber-600 uppercase">参考话术</span>
                              <ul className="mt-1 space-y-1 text-sm text-slate-600 list-disc list-inside">
                                {hoveredSkillPopover.phrasings.slice(0, 3).map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="请输入您的调解辞令..."
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  disabled={isAssessing}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading || isAssessing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white w-14 rounded-2xl transition-all shadow-lg flex items-center justify-center active:scale-95 group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
              </div>
            </div>
          </footer>
        </main>

        <aside className="hidden lg:flex w-96 bg-slate-50 flex-col overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">当事人档案</h3>
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">A</div>
                    <div>
                      <span className="text-sm font-black text-slate-800 block leading-none">{currentScenario.partyA.name}</span>
                      <span className="text-[10px] text-blue-500 font-bold uppercase mt-1 block">{currentScenario.partyA.trait}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-2xl">{currentScenario.partyA.background}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">B</div>
                    <div>
                      <span className="text-sm font-black text-slate-800 block leading-none">{currentScenario.partyB.name}</span>
                      <span className="text-[10px] text-rose-500 font-bold uppercase mt-1 block">{currentScenario.partyB.trait}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-2xl">{currentScenario.partyB.background}</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">核心诉求点</h3>
              <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-xl shadow-slate-200">
                <p className="text-[11px] font-bold leading-relaxed italic opacity-80">{currentScenario.disputePoint}</p>
              </div>
            </section>

            <section className="bg-white p-6 rounded-3xl border border-slate-100">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">快速参考</h3>
               <button 
                  onClick={() => setShowSkillsLibrary(true)}
                  className="w-full bg-slate-100 py-4 rounded-2xl flex items-center justify-center gap-3 text-xs font-black text-slate-700 hover:bg-slate-200 transition-all group"
               >
                  <IconBook /> 查阅实务技巧
               </button>
            </section>
          </div>
        </aside>
      </div>

      {assessment && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="assessment-title">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in fade-in duration-500 my-auto">
            <div className="bg-slate-950 p-12 text-white flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                   <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/30"><IconLaw /></div>
                   <h2 id="assessment-title" className="text-3xl font-black tracking-tight">调解结项分析</h2>
                </div>
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Simulation Case: {currentScenario.title}</p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                  <button type="button" onClick={handleExportWord} className="px-4 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                    导出 Word
                  </button>
                  <button type="button" onClick={handleExportPdf} className="px-4 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                    导出 PDF
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-center bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-md">
                <div className="text-7xl font-black text-blue-500 leading-none">{assessment.score}</div>
                <div className="text-[10px] font-black uppercase text-slate-400 mt-5 tracking-widest text-center">Final Proficiency Score</div>
              </div>
            </div>
            
            <div className="p-12 space-y-12 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {/* 分阶段评估结果 */}
              {assessment.stages && assessment.stages.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-[3rem] p-10 border-2 border-blue-200">
                  <h4 className="text-sm font-black text-blue-900 mb-6 flex items-center gap-3">
                    <IconSparkles /> 分阶段评估结果
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assessment.stages.map((stage, idx) => (
                      <div
                        key={stage.stage}
                        className={`bg-white p-5 rounded-2xl border-2 shadow-sm transition-all ${
                          stage.completed
                            ? stage.score && stage.score >= 80
                              ? 'border-emerald-300 bg-emerald-50/30'
                              : stage.score && stage.score >= 60
                              ? 'border-blue-300 bg-blue-50/30'
                              : 'border-amber-300 bg-amber-50/30'
                            : 'border-slate-200 bg-slate-50/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-slate-700">{stage.stage}</span>
                          {stage.completed && stage.score !== undefined ? (
                            <span
                              className={`text-lg font-black ${
                                stage.score >= 80 ? 'text-emerald-600' : stage.score >= 60 ? 'text-blue-600' : 'text-amber-600'
                              }`}
                            >
                              {stage.score}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-bold">未完成</span>
                          )}
                        </div>
                        {stage.feedback && (
                          <p className="text-[10px] text-slate-600 leading-relaxed font-medium mt-2">{stage.feedback}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">法律专业性</h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-bold italic">“{assessment.legalAccuracy}”</p>
                 </div>
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">沟通策略</h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-bold italic">“{assessment.emotionalIntelligence}”</p>
                 </div>
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">实操规范</h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-bold italic">“{assessment.procedureCompliance}”</p>
                 </div>
              </div>

              <div className="bg-blue-50 rounded-[3rem] p-10 border border-blue-100">
                <h4 className="text-sm font-black text-blue-900 mb-8 flex items-center gap-3">
                   <IconSparkles /> 导师结项带教 (Professional Feedback)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {assessment.keyAdvice.map((advice, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-blue-100 shadow-sm relative group hover:scale-[1.02] transition-transform">
                      <div className="text-5xl font-black text-blue-50 absolute right-4 top-4 opacity-50">{i+1}</div>
                      <p className="text-xs text-blue-900 font-black relative z-10 leading-relaxed pr-6">{advice}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 调解协议书生成 */}
              <div className="bg-emerald-50 rounded-[3rem] p-10 border-2 border-emerald-200">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-black text-emerald-900 flex items-center gap-3">
                    <IconBook /> 调解协议书
                  </h4>
                  {!generatedDocument && (
                    <button
                      onClick={async () => {
                        if (!currentScenario) return;
                        setIsGeneratingDocument(true);
                        try {
                          const doc = await generateMediationDocument(
                            llmProvider,
                            llmModel,
                            currentScenario,
                            messages.filter(m => m.role !== 'system')
                          );
                          setGeneratedDocument(doc);
                        } catch (error) {
                          toast.show("文书生成失败", "error");
                        } finally {
                          setIsGeneratingDocument(false);
                        }
                      }}
                      disabled={isGeneratingDocument}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingDocument ? "生成中..." : "生成协议书"}
                    </button>
                  )}
                </div>
                {generatedDocument ? (
                  <div className="bg-white rounded-2xl p-6 border border-emerald-200">
                    <textarea
                      value={generatedDocument}
                      onChange={(e) => setGeneratedDocument(e.target.value)}
                      className="w-full min-h-[300px] p-4 text-xs font-mono text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="调解协议书内容..."
                    />
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => {
                          const blob = new Blob([generatedDocument], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `调解协议书_${currentScenario?.title}_${new Date().toISOString().split('T')[0]}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700"
                      >
                        导出文档
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedDocument);
                          toast.show("已复制到剪贴板", "success");
                        }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-black rounded-xl hover:bg-slate-300"
                      >
                        复制内容
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700/70 italic">点击"生成协议书"按钮，系统将根据对话内容自动生成调解协议书草稿。</p>
                )}
              </div>
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-center gap-6">
              <button 
                onClick={() => {
                  const scenarioId = currentScenario?.id;
                  setCurrentScenario(null);
                  setMessages([]);
                  setAssessment(null);
                  setSearchParams({});
                  if (scenarioId) {
                    localStorage.removeItem(`mediation_messages_${scenarioId}`);
                    localStorage.removeItem(`mediation_moods_${scenarioId}`);
                    localStorage.removeItem(`mediation_stage_${scenarioId}`);
                  }
                }}
                className="px-14 py-5 rounded-[1.8rem] text-xs font-black text-slate-500 hover:bg-slate-200 transition-all uppercase tracking-widest border border-slate-200"
                aria-label="回到大厅"
              >
                回到大厅
              </button>
              <button 
                onClick={() => {
                  setAssessment(null);
                  startSimulation(currentScenario!);
                }}
                className="px-14 py-5 rounded-[1.8rem] text-xs font-black bg-slate-900 text-white hover:bg-black shadow-2xl shadow-slate-400 transition-all uppercase tracking-widest"
              >
                重新演练
              </button>
            </div>
          </div>
        </div>
      )}
      {showSkillsLibrary && <HandbookOverlay />}

      {llmSettingsOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4" role="dialog" aria-modal="true" aria-labelledby="llm-settings-title-2" onClick={() => setLlmSettingsOpen(false)}>
          <form
            autoComplete="off"
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => e.preventDefault()}
          >
            {/* 防止浏览器自动填充用户名/密码 */}
            <input type="text" name="fake-username" autoComplete="username" className="hidden" />
            <input type="password" name="fake-password" autoComplete="new-password" className="hidden" />
            <div className="flex justify-between items-center">
              <h3 id="llm-settings-title-2" className="text-sm font-black text-slate-900">大模型密钥配置</h3>
              <button type="button" onClick={() => setLlmSettingsOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400" aria-label="关闭">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">密钥仅存后端，前端不保存明文。再次打开可查看脱敏尾号。</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600">提供商</span>
                  <select
                    value={llmProvider}
                    onChange={(e) => {
                      const p = e.target.value as LLMProvider;
                      setLlmProvider(p);
                      const conf = llmConfig?.[p];
                      setLlmModelInput(conf?.model ?? (p === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat'));
                      setLlmBaseUrlInput('');
                      setLlmApiKeyInput('');
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="qwen">千问（通义）</option>
                  </select>
                </div>
                {isDefaultModel ? (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    已设为默认
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700 font-bold"
                    onClick={async () => {
                      const modelToUse = llmModelInput || llmModel;
                      if (!modelToUse) {
                        toast.show('请先填写或选择模型名称', 'error');
                        return;
                      }
                      try {
                        await setDefaultLLM(llmProvider, modelToUse);
                        localStorage.setItem('mediation_llm_provider', llmProvider);
                        localStorage.setItem('mediation_llm_model', modelToUse);
                        setLlmModel(modelToUse);
                        toast.show('已设为默认模型', 'success');
                      } catch (e) {
                        toast.show((e instanceof Error ? e.message : '设置失败') || '无法保存默认设置', 'error');
                      }
                    }}
                  >
                    设为默认
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">模型名称</label>
                <input
                  type="text"
                  name="llm-model"
                  autoComplete="off"
                  value={llmModelInput}
                  onChange={(e) => setLlmModelInput(e.target.value)}
                  placeholder={llmProvider === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">API Base（可选）</label>
                <input
                  type="text"
                  name="llm-base"
                  autoComplete="off"
                  value={llmBaseUrlInput}
                  onChange={(e) => setLlmBaseUrlInput(e.target.value)}
                  placeholder="留空则使用官方默认"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {llmConfig?.[llmProvider]?.baseUrl && <p className="text-[10px] text-slate-400">已配置：{llmConfig[llmProvider].baseUrl}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">API Key</label>
                <input
                  type="password"
                  name="llm-api-key"
                  autoComplete="new-password"
                  value={llmApiKeyInput}
                  onChange={(e) => setLlmApiKeyInput(e.target.value)}
                  placeholder="请输入 API Key"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {llmConfig?.[llmProvider]?.hasApiKey && llmConfig[llmProvider].keyMasked && <p className="text-[10px] text-slate-400">已保存：{llmConfig[llmProvider].keyMasked}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 flex-wrap">
              <button
                type="button"
                disabled={llmTestLoading}
                onClick={async () => {
                  setLlmTestLoading(true);
                  try {
                    const r = await testLLMSettings({
                      provider: llmProvider,
                      apiKey: llmApiKeyInput || undefined,
                      baseUrl: llmBaseUrlInput || undefined,
                      model: llmModelInput || undefined,
                    });
                    if (r.ok) toast.show('连接成功', 'success');
                    else toast.show(r.error || '连接失败', 'error');
                  } catch (e) {
                    toast.show('连接失败', 'error');
                  } finally {
                    setLlmTestLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-[11px] font-black border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                连接测试
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const updated = await updateLLMSettings({
                      provider: llmProvider,
                      apiKey: llmApiKeyInput || undefined,
                      baseUrl: llmBaseUrlInput || undefined,
                      model: llmModelInput || undefined,
                    });
                    setLlmConfig(updated);
                    if (llmModelInput) setLlmModel(llmModelInput);
                    toast.show('已保存', 'success');
                  } catch (e) {
                    console.error(e);
                    toast.show('保存失败，请检查网络或后端', 'error');
                  }
                }}
                className="px-5 py-2 rounded-xl text-[11px] font-black bg-slate-900 text白 hover:bg-black"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
