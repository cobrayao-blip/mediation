/**
 * 管理后台：用户列表 + 案例管理 + 技巧管理（仅管理员）
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, fetchWithAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchScenarios, fetchSkills, fetchUserAnalytics, type SkillApi, type ScenarioApi, type UserAnalytics } from '../services/api';

const IconSparkles = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;

export default function AdminPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<{ list: Array<{ id: string; name: string; department: string | null; email: string | null; phone: string | null; role: string; status: string }>; total: number } | null>(null);
  const [userFormOpen, setUserFormOpen] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; department: string | null; email: string | null; phone: string | null; role: string; status: string } | null>(null);
  const [userForm, setUserForm] = useState<{ name: string; department: string; email: string; phone: string; role: string; password: string; status: string }>({
    name: '', department: '', email: '', phone: '', role: 'employee', password: '', status: 'active',
  });
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioApi[]>([]);
  const [skills, setSkills] = useState<SkillApi[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [savingScenario, setSavingScenario] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [editingScenario, setEditingScenario] = useState<ScenarioApi | null>(null);
  const [editingSkill, setEditingSkill] = useState<SkillApi | null>(null);
  const [scenarioForm, setScenarioForm] = useState<{
    title: string;
    category: string;
    difficulty: string;
    description: string;
    disputePoint: string;
    partyAName: string;
    partyATrait: string;
    partyABackground: string;
    partyBName: string;
    partyBTrait: string;
    partyBBackground: string;
    sortOrder: string;
    enabled: boolean;
  }>({
    title: '',
    category: '',
    difficulty: '入门级',
    description: '',
    disputePoint: '',
    partyAName: '',
    partyATrait: '',
    partyABackground: '',
    partyBName: '',
    partyBTrait: '',
    partyBBackground: '',
    sortOrder: '0',
    enabled: true,
  });
  const [practiceSessions, setPracticeSessions] = useState<Array<{
    id: string;
    userId: string;
    scenarioId: string;
    user: { id: string; name: string; email: string | null; department: string | null };
    scenario: { id: string; title: string; category: string };
    assessment: any;
    mentorComment: string | null;
    createdAt: string;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionComment, setSessionComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [selectedUserForAnalytics, setSelectedUserForAnalytics] = useState<string | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [skillForm, setSkillForm] = useState<{ name: string; category: string; description: string; howToUse: string; phrasings: string; pitfalls: string; enabled: boolean }>({
    name: '',
    category: '',
    description: '',
    howToUse: '',
    phrasings: '',
    pitfalls: '',
    enabled: true,
  });
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [aiGeneratePrompt, setAiGeneratePrompt] = useState('');
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  useEffect(() => {
    loadUsers();
    loadScenarios();
    loadSkills();
    loadPracticeSessions();
  }, []);

  function loadScenarios() {
    setLoadingScenarios(true);
    setScenarioError(null);
    // 管理界面需要看到全部案例，因此 enabledOnly=false
    fetchScenarios(false)
      .then((list) => setScenarios(list))
      .catch(() => setScenarioError('获取案例列表失败，请稍后重试'))
      .finally(() => setLoadingScenarios(false));
  }

  function loadSkills() {
    setLoadingSkills(true);
    setSkillError(null);
    // 管理界面需要看到全部技巧，因此 enabledOnly=false
    fetchSkills(false)
      .then((list) => {
        console.log('加载到的技巧数量:', list.length);
        setSkills(list);
      })
      .catch((e) => {
        console.error('加载技巧失败:', e);
        setSkillError('获取技巧列表失败，请稍后重试');
      })
      .finally(() => setLoadingSkills(false));
  }

  async function loadPracticeSessions() {
    setLoadingSessions(true);
    try {
      const res = await fetchWithAuth('/api/practice-sessions');
      if (res.ok) {
        const data = await res.json();
        setPracticeSessions(data);
      }
    } catch (e) {
      console.error('Failed to load practice sessions:', e);
    } finally {
      setLoadingSessions(false);
    }
  }

  function loadUsers() {
    fetchWithAuth('/api/users?pageSize=100')
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }

  function openCreateUser() {
    setEditingUser(null);
    setUserForm({ name: '', department: '', email: '', phone: '', role: 'employee', password: '', status: 'active' });
    setUserFormError(null);
    setUserFormOpen('create');
  }

  function openEditUser(u: { id: string; name: string; department: string | null; email: string | null; phone: string | null; role: string; status: string }) {
    setEditingUser(u);
    setUserForm({
      name: u.name,
      department: u.department ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
      role: u.role,
      password: '',
      status: u.status,
    });
    setUserFormError(null);
    setUserFormOpen('edit');
  }

  async function saveUser() {
    if (!userForm.name.trim()) {
      setUserFormError('请填写姓名');
      return;
    }
    if (userFormOpen === 'create' && !userForm.password.trim()) {
      setUserFormError('请填写初始密码');
      return;
    }
    setSavingUser(true);
    setUserFormError(null);
    try {
      if (userFormOpen === 'create') {
        const res = await fetchWithAuth('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userForm.name.trim(),
            department: userForm.department.trim() || undefined,
            email: userForm.email.trim() || undefined,
            phone: userForm.phone.trim() || undefined,
            role: userForm.role,
            password: userForm.password,
            status: userForm.status === 'disabled' ? 'disabled' : 'active',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setUserFormError(data.error || '创建失败');
          return;
        }
        toast?.('添加用户成功');
        setUserFormOpen(null);
        loadUsers();
      } else if (editingUser) {
        const body: Record<string, unknown> = {
          name: userForm.name.trim(),
          department: userForm.department.trim() || undefined,
          email: userForm.email.trim() || undefined,
          phone: userForm.phone.trim() || undefined,
          role: userForm.role,
          status: userForm.status === 'disabled' ? 'disabled' : 'active',
        };
        if (userForm.password.trim()) body.password = userForm.password;
        const res = await fetchWithAuth(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setUserFormError(data.error || '更新失败');
          return;
        }
        toast?.('用户已更新');
        setUserFormOpen(null);
        loadUsers();
      }
    } catch (e) {
      setUserFormError('网络错误，请重试');
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUserStatus(u: { id: string; status: string }) {
    try {
      const newStatus = u.status === 'active' ? 'disabled' : 'active';
      const res = await fetchWithAuth(`/api/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast?.('状态已更新');
        loadUsers();
      } else {
        const data = await res.json();
        toast?.(data.error || '操作失败');
      }
    } catch (e) {
      toast?.('操作失败');
    }
  }

  async function deleteUser(u: { id: string; name: string }) {
    if (!window.confirm(`确定要删除用户「${u.name}」吗？此操作不可恢复。`)) return;
    try {
      const res = await fetchWithAuth(`/api/users/${u.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast?.('已删除');
        loadUsers();
      } else {
        const data = await res.json();
        toast?.(data.error || '删除失败');
      }
    } catch (e) {
      toast?.('删除失败');
    }
  }

  async function addComment(sessionId: string) {
    if (!sessionComment.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetchWithAuth(`/api/practice-sessions/${sessionId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: sessionComment }),
      });
      if (res.ok) {
        setSessionComment('');
        setSelectedSession(null);
        loadPracticeSessions();
      } else {
        alert('添加评语失败');
      }
    } catch (e) {
      console.error('Failed to add comment:', e);
      alert('添加评语失败');
    } finally {
      setSavingComment(false);
    }
  }

  function startCreateScenario() {
    console.log('startCreateScenario called');
    setEditingScenario(null);
    setAiGeneratePrompt('');
    setScenarioForm({
      title: '',
      category: '',
      difficulty: '入门级',
      description: '',
      disputePoint: '',
      partyAName: '',
      partyATrait: '',
      partyABackground: '',
      partyBName: '',
      partyBTrait: '',
      partyBBackground: '',
      sortOrder: '0',
      enabled: true,
    });
  }

  async function handleAIGenerateScenario() {
    if (!aiGeneratePrompt.trim()) return;
    setIsGeneratingScenario(true);
    setScenarioError(null);
    try {
      // 获取当前LLM配置
      const llmConfigRes = await fetchWithAuth('/api/settings/llm');
      const llmConfig = await llmConfigRes.json();
      const defaultProvider = llmConfig.qwen?.apiKey ? 'qwen' : 'deepseek';
      const defaultModel = llmConfig[defaultProvider]?.model || (defaultProvider === 'qwen' ? 'qwen3-max-preview' : 'deepseek-chat');
      
      const res = await fetchWithAuth('/api/scenarios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiGeneratePrompt.trim(),
          provider: defaultProvider,
          model: defaultModel,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '生成失败' }));
        throw new Error(err.error || '生成失败');
      }
      
      const generated = await res.json();
      
      // 填充表单
      setScenarioForm({
        title: generated.title || '',
        category: generated.category || '民事纠纷',
        difficulty: generated.difficulty || '入门级',
        description: generated.description || '',
        disputePoint: generated.disputePoint || '',
        partyAName: generated.partyA?.name || '',
        partyATrait: generated.partyA?.trait || '',
        partyABackground: generated.partyA?.background || '',
        partyBName: generated.partyB?.name || '',
        partyBTrait: generated.partyB?.trait || '',
        partyBBackground: generated.partyB?.background || '',
        sortOrder: '0',
        enabled: true,
      });
      
      setAiGeneratePrompt('');
      toast.show('案例已生成，请检查并调整后保存', 'success');
    } catch (e) {
      console.error('AI生成案例失败:', e);
      setScenarioError(e instanceof Error ? e.message : 'AI生成失败，请检查网络或LLM配置');
      toast.show('AI生成失败', 'error');
    } finally {
      setIsGeneratingScenario(false);
    }
  }

  function startEditScenario(s: ScenarioApi) {
    setEditingScenario(s);
    setScenarioForm({
      title: s.title,
      category: s.category,
      difficulty: s.difficulty || '入门级',
      description: s.description,
      disputePoint: s.disputePoint,
      partyAName: s.partyA?.name || '',
      partyATrait: s.partyA?.trait || '',
      partyABackground: s.partyA?.background || '',
      partyBName: s.partyB?.name || '',
      partyBTrait: s.partyB?.trait || '',
      partyBBackground: s.partyB?.background || '',
      sortOrder: String(s.sortOrder ?? 0),
      enabled: s.enabled !== false,
    });
  }

  async function saveScenario() {
    console.log('saveScenario called', { editingScenario, scenarioForm });
    if (!scenarioForm.title.trim() || !scenarioForm.category.trim() || !scenarioForm.description.trim() || !scenarioForm.disputePoint.trim()) {
      setScenarioError('标题、分类、简介和争议焦点为必填');
      alert('请填写所有必填字段：标题、分类、简介和争议焦点');
      return;
    }
    setSavingScenario(true);
    setScenarioError(null);
    const payload = {
      title: scenarioForm.title.trim(),
      category: scenarioForm.category.trim(),
      description: scenarioForm.description.trim(),
      difficulty: scenarioForm.difficulty.trim() || '入门级',
      disputePoint: scenarioForm.disputePoint.trim(),
      partyA: {
        name: scenarioForm.partyAName.trim() || '当事人A',
        trait: scenarioForm.partyATrait.trim(),
        background: scenarioForm.partyABackground.trim(),
      },
      partyB: {
        name: scenarioForm.partyBName.trim() || '当事人B',
        trait: scenarioForm.partyBTrait.trim(),
        background: scenarioForm.partyBBackground.trim(),
      },
      sortOrder: Number(scenarioForm.sortOrder) || 0,
      enabled: scenarioForm.enabled,
    };
    try {
      const url = editingScenario ? `/api/scenarios/${editingScenario.id}` : '/api/scenarios';
      const method = editingScenario ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || '保存失败');
      }
      await loadScenarios();
      if (!editingScenario) {
        startCreateScenario();
      }
      alert('保存成功！');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '保存失败';
      console.error('Save scenario error:', e);
      setScenarioError(errorMsg);
      alert(`保存失败：${errorMsg}`);
    } finally {
      setSavingScenario(false);
    }
  }

  async function toggleScenario(s: ScenarioApi) {
    try {
      const res = await fetchWithAuth(`/api/scenarios/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !(s.enabled !== false) }),
      });
      if (!res.ok) throw new Error();
      await loadScenarios();
    } catch {
      setScenarioError('更新启用状态失败');
    }
  }

  async function deleteScenario(s: ScenarioApi) {
    if (!window.confirm(`确定要删除案例「${s.title}」吗？`)) return;
    try {
      const res = await fetchWithAuth(`/api/scenarios/${s.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await loadScenarios();
      if (editingScenario && editingScenario.id === s.id) {
        startCreateScenario();
      }
    } catch {
      setScenarioError('删除失败');
    }
  }

  function startCreateSkill() {
    setEditingSkill(null);
    setSkillForm({
      name: '',
      category: '',
      description: '',
      howToUse: '',
      phrasings: '',
      pitfalls: '',
      enabled: true,
    });
  }

  function startEdit(skill: SkillApi) {
    setEditingSkill(skill);
    setSkillForm({
      name: skill.name,
      category: skill.category,
      description: skill.description,
      howToUse: skill.howToUse,
      phrasings: (skill.phrasings || []).join('\n'),
      pitfalls: (skill.pitfalls || []).join('\n'),
      enabled: skill.enabled !== false,
    });
  }

  async function saveSkill() {
    if (!skillForm.name.trim() || !skillForm.category.trim() || !skillForm.description.trim() || !skillForm.howToUse.trim()) {
      setSkillError('名称、分类、简介和使用方法为必填');
      return;
    }
    setSavingSkill(true);
    setSkillError(null);
    const payload = {
      name: skillForm.name.trim(),
      category: skillForm.category.trim(),
      description: skillForm.description.trim(),
      howToUse: skillForm.howToUse.trim(),
      phrasings: skillForm.phrasings
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      pitfalls: skillForm.pitfalls
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      enabled: skillForm.enabled,
    };
    try {
      const url = editingSkill ? `/api/skills/${editingSkill.id}` : '/api/skills';
      const method = editingSkill ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || '保存失败');
      }
      await loadSkills();
      if (!editingSkill) {
        // 新建后清空表单，方便继续录入
        startCreateSkill();
      }
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingSkill(false);
    }
  }

  async function toggleSkill(skill: SkillApi) {
    try {
      const res = await fetchWithAuth(`/api/skills/${skill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !(skill.enabled !== false) }),
      });
      if (!res.ok) throw new Error();
      await loadSkills();
    } catch {
      setSkillError('更新启用状态失败');
    }
  }

  async function deleteSkill(skill: SkillApi) {
    if (!window.confirm(`确定要删除技巧「${skill.name}」吗？`)) return;
    try {
      const res = await fetchWithAuth(`/api/skills/${skill.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await loadSkills();
      if (editingSkill && editingSkill.id === skill.id) {
        startCreateSkill();
      }
    } catch {
      setSkillError('删除失败');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-600 hover:text-slate-900 font-bold">
            ← 返回大厅
          </Link>
          <h1 className="text-xl font-black text-slate-900">管理后台</h1>
          {user && <span className="text-sm text-slate-500">{user.name}</span>}
        </div>
        <button onClick={logout} className="text-sm font-bold text-slate-600 hover:text-slate-900">
          退出
        </button>
      </header>
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* 数据报表 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">数据报表</h2>
              <p className="text-sm text-slate-600 mt-1">查看学员的学习轨迹、成长曲线和练习统计。</p>
            </div>
          </div>
          {users && users.list.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-600 mb-2 block">选择学员查看数据：</label>
              <select
                value={selectedUserForAnalytics || ''}
                onChange={async (e) => {
                  const userId = e.target.value;
                  setSelectedUserForAnalytics(userId || null);
                  if (userId) {
                    setLoadingAnalytics(true);
                    try {
                      const analytics = await fetchUserAnalytics(userId);
                      setUserAnalytics(analytics);
                    } catch (err) {
                      console.error('Failed to load analytics:', err);
                      alert('加载数据失败');
                    } finally {
                      setLoadingAnalytics(false);
                    }
                  } else {
                    setUserAnalytics(null);
                  }
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择学员 --</option>
                {users.list.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email || u.id})</option>
                ))}
              </select>
            </div>
          )}
          {loadingAnalytics ? (
            <p className="text-sm text-slate-500">加载中...</p>
          ) : userAnalytics ? (
            <div className="space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <div className="text-xs text-blue-600 font-bold mb-1">总练习次数</div>
                  <div className="text-3xl font-black text-blue-900">{userAnalytics.totalSessions}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <div className="text-xs text-emerald-600 font-bold mb-1">平均得分</div>
                  <div className="text-3xl font-black text-emerald-900">{userAnalytics.avgScore.toFixed(1)}</div>
                </div>
              </div>
              
              {/* 成长曲线 */}
              {userAnalytics.growthCurve.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3">成长曲线</h3>
                  <div className="h-48 flex items-end gap-2">
                    {userAnalytics.growthCurve.map((point, idx) => {
                      const maxScore = Math.max(...userAnalytics.growthCurve.map(p => p.score), 100);
                      const height = maxScore > 0 ? (point.score / maxScore) * 100 : 0;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-blue-600 rounded-t transition-all hover:bg-blue-700"
                            style={{ height: `${height}%`, minHeight: '4px' }}
                            title={`${point.date}: ${point.score}分`}
                          />
                          <div className="text-[9px] text-slate-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                            {new Date(point.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* 技巧使用统计 */}
              {Object.keys(userAnalytics.skillUsage).length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3">技巧使用统计</h3>
                  <div className="space-y-2">
                    {Object.entries(userAnalytics.skillUsage)
                      .sort((a, b) => (Number(b[1]) - Number(a[1])))
                      .slice(0, 10)
                      .map(([skill, count]) => (
                        <div key={skill} className="flex items-center justify-between">
                          <span className="text-xs text-slate-700">{skill}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${(Number(count) / Math.max(...(Object.values(userAnalytics.skillUsage) as number[]), 1)) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-600 w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* 常见错误 */}
              {userAnalytics.commonMistakes.length > 0 && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <h3 className="text-sm font-black text-amber-900 mb-3">常见改进点</h3>
                  <div className="space-y-2">
                    {userAnalytics.commonMistakes.map((item, idx) => (
                      <div key={idx} className="text-xs text-amber-800">
                        <span className="font-bold">{idx + 1}.</span> {item.mistake} <span className="text-amber-600">({item.count}次)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 最近练习记录 */}
              {userAnalytics.recentSessions.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3">最近练习记录</h3>
                  <div className="space-y-2">
                    {userAnalytics.recentSessions.map(session => (
                      <div key={session.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200">
                        <span className="text-slate-700">{session.scenario}</span>
                        <div className="flex items-center gap-3">
                          <span className={`font-black ${session.score >= 80 ? 'text-emerald-600' : session.score >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                            {session.score}分
                          </span>
                          <span className="text-slate-400">{new Date(session.date).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedUserForAnalytics && !loadingAnalytics ? (
            <p className="text-sm text-slate-500">该学员暂无练习记录。</p>
          ) : null}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900">用户管理</h2>
            <button
              type="button"
              onClick={openCreateUser}
              className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
            >
              添加用户
            </button>
          </div>
          {users ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                    <th className="py-2 pr-4">姓名</th>
                    <th className="py-2 pr-4">部门</th>
                    <th className="py-2 pr-4">邮箱</th>
                    <th className="py-2 pr-4">手机</th>
                    <th className="py-2 pr-4">角色</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.list.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium text-slate-800">{u.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{u.department || '-'}</td>
                      <td className="py-3 pr-4 text-slate-600">{u.email || '-'}</td>
                      <td className="py-3 pr-4 text-slate-600">{u.phone || '-'}</td>
                      <td className="py-3 pr-4">{u.role === 'admin' ? '管理员' : u.role === 'mentor' ? '导师' : '员工'}</td>
                      <td className="py-3 pr-4">{u.status === 'active' ? '启用' : '停用'}</td>
                      <td className="py-3 flex gap-2 flex-wrap">
                        <button type="button" onClick={() => openEditUser(u)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100">编辑</button>
                        <button type="button" onClick={() => toggleUserStatus(u)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100">{u.status === 'active' ? '停用' : '启用'}</button>
                        {u.id !== user?.id && (
                          <button type="button" onClick={() => deleteUser(u)} className="px-2 py-1 rounded-lg border border-rose-200 text-[11px] text-rose-600 hover:bg-rose-50">删除</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">共 {users.total} 人</p>
            </div>
          ) : (
            <p className="text-slate-500">加载中...</p>
          )}
        </section>

        {/* 添加/编辑用户弹窗 */}
        {userFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !savingUser && setUserFormOpen(null)}>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-black text-slate-900 mb-4">{userFormOpen === 'create' ? '添加用户' : '编辑用户'}</h3>
              {userFormError && <p className="text-sm text-rose-600 mb-3">{userFormError}</p>}
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">姓名 *</label>
                  <input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="姓名" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">部门</label>
                  <input value={userForm.department} onChange={(e) => setUserForm((f) => ({ ...f, department: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="部门" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">邮箱</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="邮箱（用于登录）" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">手机</label>
                  <input value={userForm.phone} onChange={(e) => setUserForm((f) => ({ ...f, phone: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder="手机（用于登录）" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">角色</label>
                  <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2">
                    <option value="employee">员工</option>
                    <option value="mentor">导师</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">{userFormOpen === 'create' ? '初始密码 *' : '重置密码（留空不修改）'}</label>
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2" placeholder={userFormOpen === 'create' ? '初始密码' : '留空则不修改'} />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">状态</label>
                  <select value={userForm.status} onChange={(e) => setUserForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2">
                    <option value="active">启用</option>
                    <option value="disabled">停用</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button type="button" onClick={saveUser} disabled={savingUser} className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black disabled:opacity-50">
                  {savingUser ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => !savingUser && setUserFormOpen(null)} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 text-slate-600 hover:bg-slate-100">
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">案例管理</h2>
              <p className="text-sm text-slate-600 mt-1">这里维护首页展示和实训使用的调解案例，可配置分类、难度和当事人信息。</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startCreateScenario}
                className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
              >
                新建案例
              </button>
            </div>
          </div>

          {/* AI生成案例 - 始终显示 */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                  <IconSparkles />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-slate-900 mb-2">AI 智能生成案例</h3>
                  <p className="text-xs text-slate-600 mb-3">输入一句话描述，AI 将自动生成完整的案例信息</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiGeneratePrompt}
                      onChange={(e) => setAiGeneratePrompt(e.target.value)}
                      placeholder="例如：楼上漏水导致楼下装修受损，双方就赔偿金额产生分歧"
                      className="flex-1 bg-white border-2 border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && aiGeneratePrompt.trim()) {
                          e.preventDefault();
                          handleAIGenerateScenario();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAIGenerateScenario}
                      disabled={!aiGeneratePrompt.trim() || isGeneratingScenario}
                      className="px-4 py-2 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isGeneratingScenario ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          生成中...
                        </>
                      ) : (
                        <>
                          <IconSparkles className="w-4 h-4" />
                          AI生成
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {scenarioError && <p className="text-xs text-rose-500 mb-3">{scenarioError}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-4 max-h-[420px] overflow-auto">
              {loadingScenarios ? (
                <p className="text-sm text-slate-500">案例列表加载中...</p>
              ) : scenarios.length === 0 ? (
                <p className="text-sm text-slate-500">暂无案例，请右侧新建。</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                      <th className="py-2 pr-2">标题</th>
                      <th className="py-2 pr-2">分类</th>
                      <th className="py-2 pr-2">难度</th>
                      <th className="py-2 pr-2">状态</th>
                      <th className="py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2 font-medium text-slate-800">{s.title}</td>
                        <td className="py-2 pr-2 text-slate-600">{s.category}</td>
                        <td className="py-2 pr-2 text-slate-600">{s.difficulty}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                              s.enabled === false
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}
                          >
                            {s.enabled === false ? '停用' : '启用'}
                          </span>
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => startEditScenario(s)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleScenario(s)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            {s.enabled === false ? '启用' : '停用'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteScenario(s)}
                            className="px-2 py-1 rounded-lg border border-rose-200 text-[11px] text-rose-700 hover:bg-rose-50"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
              <h3 className="text-sm font-black text-slate-900">
                {editingScenario ? `编辑案例：${editingScenario.title}` : '新建案例'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">标题</label>
                  <input
                    type="text"
                    value={scenarioForm.title}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">分类</label>
                  <input
                    type="text"
                    value={scenarioForm.category}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="如：民事纠纷 / 商事调解"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">难度</label>
                  <select
                    value={scenarioForm.difficulty}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, difficulty: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="入门级">入门级</option>
                    <option value="进阶级">进阶级</option>
                    <option value="专业级">专业级</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">排序（数字越小越靠前）</label>
                  <input
                    type="number"
                    value={scenarioForm.sortOrder}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">简介（背景描述）</label>
                <textarea
                  value={scenarioForm.description}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">争议焦点（disputePoint）</label>
                <textarea
                  value={scenarioForm.disputePoint}
                  onChange={(e) => setScenarioForm((f) => ({ ...f, disputePoint: e.target.value }))}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">当事人 A 姓名</label>
                  <input
                    type="text"
                    value={scenarioForm.partyAName}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, partyAName: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <label className="text-[11px] font-bold text-slate-600 mt-2 block">性格特征</label>
                  <input
                    type="text"
                    value={scenarioForm.partyATrait}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, partyATrait: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <label className="text-[11px] font-bold text-slate-600 mt-2 block">背景</label>
                  <textarea
                    value={scenarioForm.partyABackground}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, partyABackground: e.target.value }))}
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">当事人 B 姓名</label>
                  <input
                    type="text"
                    value={scenarioForm.partyBName}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, partyBName: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <label className="text-[11px] font-bold text-slate-600 mt-2 block">性格特征</label>
                  <input
                    type="text"
                    value={scenarioForm.partyBTrait}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, partyBTrait: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <label className="text-[11px] font-bold text-slate-600 mt-2 block">背景</label>
                  <textarea
                    value={scenarioForm.partyBBackground}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, partyBBackground: e.target.value }))}
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={scenarioForm.enabled}
                    onChange={(e) => setScenarioForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  启用（展示在大厅和实训中）
                </label>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Reset button clicked');
                      startCreateScenario();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    重置
                  </button>
                  <button
                    type="button"
                    disabled={savingScenario}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Save button clicked');
                      saveScenario();
                    }}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-black bg-slate-900 text-white hover:bg-black disabled:opacity-60 cursor-pointer"
                  >
                    {savingScenario ? '保存中...' : '保存案例'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">技巧实务手册管理</h2>
              <p className="text-sm text-slate-600 mt-1">
                当前案例共 {scenarios.length} 条，技巧 {skills.length} 条。这里可以直接维护带教推荐所用的技巧库。
              </p>
            </div>
            <button
              type="button"
              onClick={startCreateSkill}
              className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
            >
              新建技巧
            </button>
          </div>

          {skillError && <p className="text-xs text-rose-500 mb-3">{skillError}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-4 max-h-[420px] overflow-auto">
              {loadingSkills ? (
                <p className="text-sm text-slate-500">技巧列表加载中...</p>
              ) : skills.length === 0 ? (
                <p className="text-sm text-slate-500">暂无技巧，请右侧新建。</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                      <th className="py-2 pr-2">名称</th>
                      <th className="py-2 pr-2">分类</th>
                      <th className="py-2 pr-2">状态</th>
                      <th className="py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skills.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2 font-medium text-slate-800">{s.name}</td>
                        <td className="py-2 pr-2 text-slate-600">{s.category}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                              s.enabled === false
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}
                          >
                            {s.enabled === false ? '停用' : '启用'}
                          </span>
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSkill(s)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            {s.enabled === false ? '启用' : '停用'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSkill(s)}
                            className="px-2 py-1 rounded-lg border border-rose-200 text-[11px] text-rose-700 hover:bg-rose-50"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
              <h3 className="text-sm font-black text-slate-900">
                {editingSkill ? `编辑技巧：${editingSkill.name}` : '新建技巧'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">名称</label>
                  <input
                    type="text"
                    value={skillForm.name}
                    onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">分类</label>
                  <input
                    type="text"
                    value={skillForm.category}
                    onChange={(e) => setSkillForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="如：沟通技巧 / 程序控制"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">简介（描述）</label>
                <textarea
                  value={skillForm.description}
                  onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">使用方法（howToUse）</label>
                <textarea
                  value={skillForm.howToUse}
                  onChange={(e) => setSkillForm((f) => ({ ...f, howToUse: e.target.value }))}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">推荐话术（每行一条）</label>
                  <textarea
                  value={skillForm.phrasings}
                  onChange={(e) => setSkillForm((f) => ({ ...f, phrasings: e.target.value }))}
                    rows={4}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">常见误区（每行一条）</label>
                  <textarea
                  value={skillForm.pitfalls}
                  onChange={(e) => setSkillForm((f) => ({ ...f, pitfalls: e.target.value }))}
                    rows={4}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={skillForm.enabled}
                    onChange={(e) => setSkillForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  启用（展示在实训机技巧手册中）
                </label>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={startCreateSkill}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                  >
                    重置
                  </button>
                  <button
                    type="button"
                    disabled={savingSkill}
                    onClick={saveSkill}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-black bg-slate-900 text-white hover:bg-black disabled:opacity-60"
                  >
                    {savingSkill ? '保存中...' : '保存技巧'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 练习记录管理 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">练习记录管理</h2>
              <p className="text-sm text-slate-600 mt-1">查看学员的练习记录，查看对话内容和评估结果，并添加导师评语。</p>
            </div>
          </div>
          {loadingSessions ? (
            <p className="text-sm text-slate-500">加载中...</p>
          ) : practiceSessions.length === 0 ? (
            <p className="text-sm text-slate-500">暂无练习记录。</p>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                    <th className="py-2 pr-2">学员</th>
                    <th className="py-2 pr-2">案例</th>
                    <th className="py-2 pr-2">综合得分</th>
                    <th className="py-2 pr-2">练习时间</th>
                    <th className="py-2 pr-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {practiceSessions.map((session) => {
                    const assessment = session.assessment as { score?: number } | null;
                    return (
                      <tr key={session.id} className="border-b border-slate-100">
                        <td className="py-2 pr-2">
                          <div>
                            <div className="font-bold text-slate-800">{session.user.name}</div>
                            <div className="text-[10px] text-slate-400">{session.user.email || session.user.department || ''}</div>
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <div className="font-medium text-slate-700">{session.scenario.title}</div>
                          <div className="text-[10px] text-slate-400">{session.scenario.category}</div>
                        </td>
                        <td className="py-2 pr-2">
                          {assessment?.score !== undefined ? (
                            <span className={`font-black ${assessment.score >= 80 ? 'text-emerald-600' : assessment.score >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                              {assessment.score}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-slate-500">
                          {new Date(session.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="py-2 pr-2">
                          <button
                            onClick={() => {
                              setSelectedSession(selectedSession === session.id ? null : session.id);
                              setSessionComment(session.mentorComment || '');
                            }}
                            className="px-3 py-1 rounded-lg text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700"
                          >
                            {selectedSession === session.id ? '收起' : '查看详情'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {selectedSession && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  {(() => {
                    const session = practiceSessions.find(s => s.id === selectedSession);
                    if (!session) return null;
                    const assessment = session.assessment as any;
                    return (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-slate-700 mb-2">评估结果</h4>
                          {assessment && (
                            <div className="bg-white p-3 rounded-lg text-[10px] space-y-2">
                              {assessment.score !== undefined && (
                                <div><span className="font-bold">综合得分：</span>{assessment.score}</div>
                              )}
                              {assessment.legalAccuracy && (
                                <div><span className="font-bold">法律专业性：</span>{assessment.legalAccuracy}</div>
                              )}
                              {assessment.emotionalIntelligence && (
                                <div><span className="font-bold">沟通策略：</span>{assessment.emotionalIntelligence}</div>
                              )}
                              {assessment.procedureCompliance && (
                                <div><span className="font-bold">实操规范：</span>{assessment.procedureCompliance}</div>
                              )}
                              {assessment.stages && Array.isArray(assessment.stages) && (
                                <div className="mt-2">
                                  <span className="font-bold">分阶段评估：</span>
                                  <div className="mt-1 space-y-1">
                                    {assessment.stages.map((s: any, i: number) => (
                                      <div key={i} className="text-slate-600">
                                        {s.stage}: {s.completed ? (s.score !== undefined ? `${s.score}分` : '已完成') : '未完成'}
                                        {s.feedback && <span className="text-slate-400 ml-2">({s.feedback})</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-700 mb-2">导师评语</h4>
                          <textarea
                            value={sessionComment}
                            onChange={(e) => setSessionComment(e.target.value)}
                            placeholder="输入评语..."
                            rows={4}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => addComment(selectedSession)}
                              disabled={savingComment || !sessionComment.trim()}
                              className="px-4 py-1.5 rounded-lg text-[11px] font-black bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingComment ? '保存中...' : '保存评语'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
