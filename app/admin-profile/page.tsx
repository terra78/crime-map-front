'use client'

import { useState, useEffect } from 'react'
import { fetchAdminProfile, updateAdminProfile, AdminProfile } from '../lib/api'

export default function AdminProfilePage() {
  const [token, setToken]       = useState<string | null>(null)
  const [profile, setProfile]   = useState<AdminProfile | null>(null)
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [saved, setSaved]       = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
    if (!tok) { setUnauthorized(true); setLoading(false); return }
    setToken(tok)
    fetchAdminProfile(tok).then(p => {
      if (!p) { setUnauthorized(true); setLoading(false); return }
      setProfile(p)
      setEmail(p.email)
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !email.trim()) return
    setSaving(true); setError(''); setSaved(false)
    const ok = await updateAdminProfile(token, email.trim())
    setSaving(false)
    if (ok) {
      setSaved(true)
      setProfile(prev => prev ? { ...prev, email: email.trim() } : prev)
    } else {
      setError('保存に失敗しました。もう一度お試しください。')
    }
  }

  const fontFamily = "'Noto Sans JP', sans-serif"

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0f1a', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily, color: '#64748b', fontSize: 14,
      }}>
        読み込み中…
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0f1a', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily, flexDirection: 'column', gap: 12,
      }}>
        <div style={{ color: '#ef4444', fontSize: 14 }}>管理者権限がありません</div>
        <a href="/" style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none' }}>← トップに戻る</a>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0f1a',
      fontFamily, color: '#e2e8f0',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 64, padding: '64px 16px',
    }}>
      {/* ヘッダー */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: 32 }}>
        <a href="/" style={{
          color: '#64748b', fontSize: 12, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          ← トップに戻る
        </a>
      </div>

      {/* カード */}
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#111827', border: '1px solid #1e2d40',
        borderRadius: 12, padding: 32,
      }}>
        {/* タイトル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 4, height: 20, background: '#FF7043', borderRadius: 2 }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>
            管理者プロフィール
          </h1>
        </div>

        {/* 現在の情報 */}
        {profile && (
          <div style={{
            background: '#0a0f1a', border: '1px solid #1e2d40',
            borderRadius: 8, padding: '12px 16px', marginBottom: 24,
            fontSize: 11, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div>管理者ID: #{profile.id}</div>
            <div>登録日: {new Date(profile.created_at).toLocaleDateString('ja-JP')}</div>
          </div>
        )}

        {/* 編集フォーム */}
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 12, color: '#94a3b8',
              marginBottom: 8, letterSpacing: '0.05em',
            }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setSaved(false); setError('') }}
              placeholder="example@email.com"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0a0f1a', border: '1px solid #1e2d40',
                borderRadius: 8, color: '#e2e8f0', fontSize: 14,
                padding: '12px 14px', outline: 'none',
                fontFamily,
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: '8px 12px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444455',
              borderRadius: 6, color: '#f87171', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          {saved && (
            <div style={{
              marginBottom: 14, padding: '8px 12px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid #10b98155',
              borderRadius: 6, color: '#34d399', fontSize: 12,
            }}>
              ✅ 保存しました
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !email.trim()}
            style={{
              width: '100%', padding: '12px',
              background: saving || !email.trim() ? '#1e3a5f' : '#4FC3F7',
              color: saving || !email.trim() ? '#475569' : '#0a0f1a',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily,
            }}
          >
            {saving ? '保存中…' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  )
}
