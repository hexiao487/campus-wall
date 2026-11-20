'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { compressImage } from '@/lib/imageCompress';

export default function AccountMenu({ me, onLogout }) {
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState(null);
  const [name, setName] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!me) return null;

  const close = () => {
    setMenu(false);
    setMode(null);
    setMsg('');
    setPwd('');
  };

  async function saveName(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '修改失败');
      setMsg('昵称已更新，正在刷新…');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const prepared = await compressImage(file, { maxSide: 512 });
      const fd = new FormData();
      fd.append('file', prepared);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upd = await up.json();
      if (!up.ok) throw new Error(upd.error || '上传失败');
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: upd.url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '换头像失败');
      setMsg('头像已更新，正在刷新…');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    close();
    if (onLogout) {
      await onLogout();
      return;
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  function switchAccount() {
    close();
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/login';
    });
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注销失败');
      window.location.href = '/';
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="menu-fab" onClick={() => setMenu(true)} aria-label="菜单">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {menu && typeof document !== 'undefined' && createPortal(
        <div className="sheet-mask" onClick={close}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-bar" />
            <div className="sheet-title">菜单</div>
            {msg && <div className="sheet-msg">{msg}</div>}

            {!mode && (
              <>
                <button className="glass-btn sheet-item" onClick={() => { setMode('name'); setName(me.username || ''); }}>
                  改昵称
                </button>
                <label className="glass-btn sheet-item">
                  换头像
                  <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
                </label>
                <button className="glass-btn sheet-item" onClick={doLogout}>退出登录</button>
                <button className="glass-btn sheet-item" onClick={switchAccount}>切换账号</button>
                <button className="glass-btn sheet-item danger" onClick={() => setMode('delete')}>注销账号</button>
              </>
            )}

            {mode === 'name' && (
              <form className="sheet-form" onSubmit={saveName}>
                <label className="sheet-label">新的昵称</label>
                <input className="sheet-input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="2-20 个字符" />
                <button className="glass-btn sheet-item" disabled={busy}>{busy ? '保存中…' : '保存昵称'}</button>
                <button type="button" className="glass-btn sheet-item ghost" onClick={() => { setMode(null); setMsg(''); }}>返回</button>
              </form>
            )}

            {mode === 'delete' && (
              <form className="sheet-form" onSubmit={deleteAccount}>
                <div className="sheet-warn">注销后账号无法恢复，你的帖子会保留。请输入密码确认。</div>
                <input className="sheet-input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="输入登录密码" />
                <button className="glass-btn sheet-item danger" disabled={busy}>{busy ? '处理中…' : '确认注销'}</button>
                <button type="button" className="glass-btn sheet-item ghost" onClick={() => { setMode(null); setMsg(''); }}>返回</button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
