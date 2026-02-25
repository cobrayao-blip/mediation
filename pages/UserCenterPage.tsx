/**
 * 用户中心：个人资料、修改密码、我的练习记录
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, fetchWithAuth } from '../contexts/AuthContext';

type Profile = {
  id: string;
  name: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
};

type PracticeSessionItem = {
  id: string;
  scenarioId: string;
  scenario: { id: string; title: string; category: string; difficulty: string };
  assessment: { score?: number; stages?: Array<{ stage: string; score?: number }> } | null;
  mentorComment: string | null;
  createdAt: string;
};

const roleLabel: Record<string, string> = { admin: '管理员', mentor: '导师', employee: '员工' };

export default function UserCenterPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileForm, setProfileForm] = useState<{ name: string; department: string; email: string; phone: string }>({ name: '', department: '', email: '', phone: '' });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [sessions, setSessions] = useState<PracticeSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth('/api/users/me')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setProfileForm({
          name: data.name ?? '',
          department: data.department ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, []);

  useEffect(() => {
    fetchWithAuth('/api/users/me/practice-sessions')
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await fetchWithAuth('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name.trim(),
          department: profileForm.department.trim() || undefined,
          email: profileForm.email.trim() || undefined,
          phone: profileForm.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || '更新失败');
        return;
      }
      setProfile(data);
      setProfileEditing(false);
      // 可选：同步 AuthContext 中的 name（需在 AuthContext 暴露 setUser 或 refetch）
    } catch (e) {
      setProfileError('网络错误');
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword() {
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('新密码至少 6 位');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      const res = await fetchWithAuth('/api/users/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || '修改失败');
        return;
      }
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setPasswordError('网络错误');
    } finally {
      setPasswordSaving(false);
    }
  }

  function scoreFromAssessment(a: PracticeSessionItem['assessment']): number | null {
    if (!a) return null;
    if (typeof a.score === 'number') return a.score;
    return null;
  }

  if (profileLoading && !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-medium">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors" aria-label="返回首页">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </Link>
            <h1 className="text-xl font-black text-slate-900">用户中心</h1>
          </div>
          <span className="text-sm font-bold text-slate-600">{user?.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* 个人资料 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-black text-slate-900 mb-4">个人资料</h2>
          {profile && !profileEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">姓名</span><p className="font-medium text-slate-800">{profile.name}</p></div>
              <div><span className="text-slate-500">部门</span><p className="font-medium text-slate-800">{profile.department || '-'}</p></div>
              <div><span className="text-slate-500">邮箱</span><p className="font-medium text-slate-800">{profile.email || '-'}</p></div>
              <div><span className="text-slate-500">手机</span><p className="font-medium text-slate-800">{profile.phone || '-'}</p></div>
              <div><span className="text-slate-500">角色</span><p className="font-medium text-slate-800">{roleLabel[profile.role] ?? profile.role}</p></div>
              <div><span className="text-slate-500">状态</span><p className="font-medium text-slate-800">{profile.status === 'active' ? '启用' : '停用'}</p></div>
            </div>
          ) : profile ? (
            <div className="space-y-4 max-w-md">
              {profileError && <p className="text-sm text-rose-600">{profileError}</p>}
              <div>
                <label className="block text-slate-600 font-medium mb-1">姓名</label>
                <input value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">部门</label>
                <input value={profileForm.department} onChange={(e) => setProfileForm((f) => ({ ...f, department: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">邮箱</label>
                <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">手机</label>
                <input value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveProfile} disabled={profileSaving} className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black disabled:opacity-50">
                  {profileSaving ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => setProfileEditing(false)} className="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 text-slate-600 hover:bg-slate-100">取消</button>
              </div>
            </div>
          ) : null}
          {profile && !profileEditing && (
            <button type="button" onClick={() => setProfileEditing(true)} className="mt-4 px-4 py-2 rounded-xl text-xs font-black border border-slate-200 text-slate-600 hover:bg-slate-100">
              编辑资料
            </button>
          )}
        </section>

        {/* 修改密码 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-black text-slate-900 mb-4">修改密码</h2>
          <div className="space-y-4 max-w-md">
            {passwordError && <p className="text-sm text-rose-600">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-emerald-600">密码已修改，请使用新密码登录。</p>}
            <div>
              <label className="block text-slate-600 font-medium mb-1">当前密码</label>
              <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="当前密码" />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">新密码</label>
              <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="至少 6 位" />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">确认新密码</label>
              <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="再次输入新密码" />
            </div>
            <button type="button" onClick={changePassword} disabled={passwordSaving} className="px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black disabled:opacity-50">
              {passwordSaving ? '提交中...' : '修改密码'}
            </button>
          </div>
        </section>

        {/* 我的练习记录 */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-black text-slate-900 mb-4">我的练习记录</h2>
          {sessionsLoading ? (
            <p className="text-sm text-slate-500">加载中...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500">暂无练习记录，去 <Link to="/" className="text-blue-600 font-medium hover:underline">首页</Link> 选择案例开始实训。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 font-bold">
                    <th className="py-2 pr-4">案例</th>
                    <th className="py-2 pr-4">分类</th>
                    <th className="py-2 pr-4">难度</th>
                    <th className="py-2 pr-4">得分</th>
                    <th className="py-2 pr-4">练习时间</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const score = scoreFromAssessment(s.assessment);
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-800">{s.scenario.title}</td>
                        <td className="py-3 pr-4 text-slate-600">{s.scenario.category}</td>
                        <td className="py-3 pr-4 text-slate-600">{s.scenario.difficulty}</td>
                        <td className="py-3 pr-4">
                          {score != null ? (
                            <span className={score >= 80 ? 'text-emerald-600 font-bold' : score >= 60 ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold'}>{score} 分</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{new Date(s.createdAt).toLocaleString('zh-CN')}</td>
                        <td className="py-3">
                          <Link to={`/?scenarioId=${s.scenario.id}`} className="text-blue-600 hover:underline text-xs font-medium">查看案例</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-2">共 {sessions.length} 条记录</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
