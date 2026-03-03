'use client'

import { useState, useCallback } from 'react'
import {
  fetchAdminQueue, fetchAdminStats,
  adminApprove, adminReject, adminRejectExcludeKeywords,
  adminUpdateQueueItem,
  AdminReport, AdminStats,
} from '../lib/api'
import { NATIONALITY_GROUPS } from '../lib/nationalityData'

// ── スタイル定数 ─────────────────────────────────────────────────────────────
const BG   = '#0a0f1a'
const CARD = '#0f1923'
const BORDER = '#1e2d40'
const TEXT  = '#e2e8f0'
const MUTED = '#64748b'

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11,
      background: color + '22', color, border: `1px solid ${color}44`,
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: 8, padding: '16px 20px', minWidth: 120, textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ── 国籍インライン編集コンポーネント ──────────────────────────────────────────
function NationalityEditor({
  reportId,
  token,
  current,
  onSaved,
}: {
  reportId: number
  token: string
  current: string
  onSaved: (newValue: string) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(current)
  const [saving, setSaving]     = useState(false)

  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: MUTED }}>🏳️ {current || '（未設定）'}</span>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'none', border: '1px solid #1e3a5f',
            borderRadius: 4, color: '#4FC3F7', fontSize: 11,
            cursor: 'pointer', padding: '1px 8px',
          }}
        >編集</button>
      </span>
    )
  }

  async function handleSave() {
    setSaving(true)
    const ok = await adminUpdateQueueItem(token, reportId, value)
    setSaving(false)
    if (ok) {
      onSaved(value)
      setEditing(false)
    } else {
      alert('保存に失敗しました')
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{
          background: '#0a0f1a', border: `1px solid ${BORDER}`,
          borderRadius: 4, color: TEXT, fontSize: 12,
          padding: '3px 6px', outline: 'none', cursor: 'pointer',
        }}
      >
        {NATIONALITY_GROUPS.map(g => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map(o => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        ))}
      </select>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saving ? '#1e3a5f' : '#4FC3F7',
          color: saving ? '#475569' : '#0a0f1a',
          border: 'none', borderRadius: 4, fontSize: 11,
          fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          padding: '3px 10px',
        }}
      >{saving ? '保存中…' : '保存'}</button>
      <button
        onClick={() => { setEditing(false); setValue(current) }}
        style={{
          background: 'none', border: 'none', color: MUTED,
          fontSize: 11, cursor: 'pointer', padding: 0,
        }}
      >キャンセル</button>
    </span>
  )
}

// ── メインコンポーネント ──────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken]       = useState('')
  const [input, setInput]       = useState('')
  const [queue, setQueue]       = useState<AdminReport[] | null>(null)
  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [actioning, setActioning]       = useState<number | null>(null)
  const [bulkRejecting, setBulkRejecting] = useState(false)
  const [bulkResult, setBulkResult]       = useState<string>('')

  const load = useCallback(async (tk: string) => {
    setLoading(true)
    setError('')
    const [q, s] = await Promise.all([fetchAdminQueue(tk), fetchAdminStats(tk)])
    setLoading(false)
    if (q === null) {
      setError('トークンが無効です')
      setToken('')
      return
    }
    setToken(tk)
    setQueue(q)
    setStats(s)
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) load(input.trim())
  }

  const handleApprove = async (id: number) => {
    setActioning(id)
    const ok = await adminApprove(token, id)
    if (ok) setQueue(q => q?.filter(r => r.id !== id) ?? null)
    setActioning(null)
  }

  const handleReject = async (id: number) => {
    setActioning(id)
    const ok = await adminReject(token, id)
    if (ok) setQueue(q => q?.filter(r => r.id !== id) ?? null)
    setActioning(null)
  }

  const handleBulkRejectExclude = async () => {
    if (!confirm('裁判・考察記事キーワードに一致する承認待ち記事をすべて却下します。よろしいですか？')) return
    setBulkRejecting(true)
    setBulkResult('')
    const res = await adminRejectExcludeKeywords(token)
    setBulkRejecting(false)
    if (res === null) {
      setBulkResult('❌ 実行に失敗しました')
    } else {
      setBulkResult(`✅ ${res.rejected_count}件を却下しました`)
      load(token)   // キューと統計を更新
    }
  }

  /** 国籍フィールドをキュー内で更新（再フェッチなし） */
  const handleNationalitySaved = (reportId: number, newValue: string) => {
    setQueue(q => q?.map(r =>
      r.id === reportId
        ? { ...r, data: { ...r.data, nationality_type: newValue } }
        : r
    ) ?? null)
  }

  // ── ログイン前 ──────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', background: BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Noto Sans JP', sans-serif",
      }}>
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: 40, width: 360,
        }}>
          <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            🔐 管理画面
          </h1>
          <p style={{ color: MUTED, fontSize: 13, margin: '0 0 24px' }}>
            ADMIN_TOKEN を入力してください
          </p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="admin token"
              style={{
                width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                background: '#0a0f1a', border: `1px solid ${BORDER}`,
                borderRadius: 6, color: TEXT, fontSize: 14, marginBottom: 12,
                outline: 'none',
              }}
            />
            {error && (
              <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '10px 0',
                background: '#FF7043', color: 'white', border: 'none',
                borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {loading ? '確認中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── ログイン後 ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: BG, color: TEXT,
      fontFamily: "'Noto Sans JP', sans-serif", padding: '32px 24px',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📋 モデレーション管理</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {bulkResult && (
            <span style={{ fontSize: 12, color: bulkResult.startsWith('✅') ? '#34d399' : '#f87171' }}>
              {bulkResult}
            </span>
          )}
          <button
            onClick={handleBulkRejectExclude}
            disabled={bulkRejecting}
            style={{
              padding: '7px 14px', background: bulkRejecting ? '#374151' : '#7f1d1d',
              color: '#fca5a5', border: '1px solid #991b1b',
              borderRadius: 6, fontSize: 13,
              cursor: bulkRejecting ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {bulkRejecting ? '処理中...' : '🚫 裁判/考察を一括却下'}
          </button>
          <button
            onClick={() => load(token)}
            style={{
              padding: '7px 14px', background: 'transparent',
              color: '#94a3b8', border: `1px solid ${BORDER}`,
              borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            🔄 更新
          </button>
          <button
            onClick={() => { setToken(''); setQueue(null); setStats(null) }}
            style={{
              padding: '7px 14px', background: 'transparent',
              color: '#94a3b8', border: `1px solid ${BORDER}`,
              borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* 統計カード */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          <StatCard label="総投稿数"     value={stats.total}    color="#94a3b8" />
          <StatCard label="承認済み"     value={stats.approved} color="#34d399" />
          <StatCard label="承認待ち"     value={stats.pending}  color="#fbbf24" />
          <StatCard label="却下"         value={stats.rejected} color="#f87171" />
        </div>
      )}

      {/* 承認待ちキュー */}
      <h2 style={{ fontSize: 16, fontWeight: 600, color: MUTED, margin: '0 0 16px' }}>
        承認待ち {queue ? `（${queue.length}件）` : ''}
      </h2>

      {loading && (
        <p style={{ color: MUTED }}>読み込み中...</p>
      )}

      {queue && queue.length === 0 && (
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: 32, textAlign: 'center', color: MUTED,
        }}>
          承認待ちの投稿はありません ✅
        </div>
      )}

      {queue && queue.map(r => (
        <div key={r.id} style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: 20, marginBottom: 12,
        }}>
          {/* 上段：ID・タイトル・AIスコア */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ color: MUTED, fontSize: 12 }}>#{r.id}</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{r.title ?? '（タイトルなし）'}</span>
            {r.ai_score !== null && (
              <Badge
                label={`AI: ${(r.ai_score * 100).toFixed(0)}%`}
                color={r.ai_score >= 0.8 ? '#34d399' : r.ai_score < 0.5 ? '#f87171' : '#fbbf24'}
              />
            )}
            {r.data?.incident_type && (
              <Badge label={r.data.incident_type} color="#60a5fa" />
            )}
          </div>

          {/* 詳細情報 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 12 }}>
            {r.description && (
              <div style={{ gridColumn: '1 / -1', color: '#94a3b8' }}>
                📝 {r.description}
              </div>
            )}
            {r.data?.address && (
              <div style={{ color: MUTED }}>📍 {r.data.address}</div>
            )}
            {/* 国籍インライン編集 */}
            <div>
              <NationalityEditor
                reportId={r.id}
                token={token}
                current={r.data?.nationality_type || '不明'}
                onSaved={newVal => handleNationalitySaved(r.id, newVal)}
              />
            </div>
            {/* 発生年月日 */}
            {r.occurred_at && (
              <div style={{ color: MUTED, fontSize: 12 }}>
                📅 発生日: {r.occurred_at}
              </div>
            )}
            <div style={{ color: MUTED, fontSize: 12 }}>
              🕐 投稿: {new Date(r.created_at).toLocaleString('ja-JP')}
            </div>
          </div>

          {/* AI判定理由 */}
          {r.ai_reason && (
            <div style={{
              background: '#0a0f1a', border: `1px solid ${BORDER}`,
              borderRadius: 6, padding: '8px 12px', fontSize: 12,
              color: '#94a3b8', marginBottom: 12,
            }}>
              🤖 AI: {r.ai_reason}
            </div>
          )}

          {/* ソースURL */}
          {(r.source_url || r.archive_url) && (
            <div style={{ fontSize: 12, marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {r.source_url && (
                <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#60a5fa', textDecoration: 'none' }}>
                  🔗 ソース
                </a>
              )}
              {r.archive_url && (
                <a href={r.archive_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#a78bfa', textDecoration: 'none' }}>
                  📦 魚拓
                </a>
              )}
            </div>
          )}

          {/* 承認・却下ボタン */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleApprove(r.id)}
              disabled={actioning === r.id}
              style={{
                padding: '8px 20px', background: '#065f46', color: '#34d399',
                border: '1px solid #34d39944', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {actioning === r.id ? '...' : '✅ 承認'}
            </button>
            <button
              onClick={() => handleReject(r.id)}
              disabled={actioning === r.id}
              style={{
                padding: '8px 20px', background: '#7f1d1d', color: '#f87171',
                border: '1px solid #f8717144', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {actioning === r.id ? '...' : '❌ 却下'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
