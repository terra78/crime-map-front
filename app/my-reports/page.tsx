'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { fetchMyReports, updateMyReport, deleteMyReport, Report } from '../lib/api'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故':           '#F59E0B',
  '窃盗・万引き':       '#EF4444',
  '暴行・傷害':         '#DC2626',
  '詐欺':               '#8B5CF6',
  '薬物':               '#EC4899',
  '性犯罪':             '#F97316',
  '殺人・傷害致死':     '#B91C1C',
  '不法滞在・入管違反': '#6366F1',
  'その他':             '#6B7280',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:        { label: '審査待ち',   color: '#F59E0B', bg: '#F59E0B22' },
  ai_approved:    { label: 'AI承認済み', color: '#22C55E', bg: '#22C55E22' },
  human_approved: { label: '承認済み',   color: '#22C55E', bg: '#22C55E22' },
  rejected:       { label: '却下',       color: '#EF4444', bg: '#EF444422' },
}

const INCIDENT_OPTIONS = [
  '交通事故', '窃盗・万引き', '暴行・傷害', '詐欺', '薬物',
  '性犯罪', '殺人・傷害致死', '不法滞在・入管違反', 'その他',
]

const S = {
  input: {
    width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40',
    borderRadius: 6, padding: '8px 10px', color: '#e2e8f0', fontSize: 13,
    outline: 'none', boxSizing: 'border-box' as const,
  },
  label: { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 },
}

type FieldGroup  = { label: string; options: string[] }
type SiteTypeApi = { fields: { key: string; options?: string[]; groups?: FieldGroup[] }[] }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── 編集モーダル ─────────────────────────────────────────────────────────────
function EditModal({
  report,
  token,
  onSaved,
  onClose,
}: {
  report: Report
  token: string
  onSaved: (updated: Partial<Report>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title:            report.title ?? '',
    description:      (report as any).description ?? '',
    incident_type:    report.data?.incident_type ?? 'その他',
    nationality_type: report.data?.nationality_type ?? '日本',
    address:          report.address ?? '',
    occurred_at:      report.occurred_at ?? '',
    source_url:       report.data?.source_url ?? '',
  })
  const [saving, setSaving]               = useState(false)
  const [err, setErr]                     = useState('')
  const [incidentOptions, setIncidentOptions]       = useState<string[]>(INCIDENT_OPTIONS)
  const [nationalityGroups, setNationalityGroups]   = useState<FieldGroup[]>([])
  const [nationalityOptions, setNationalityOptions] = useState<string[]>([])

  // site_typeからフィールド選択肢を取得
  useEffect(() => {
    fetch(`${API_BASE}/api/site_types/crime`)
      .then(r => r.json())
      .then((data: SiteTypeApi) => {
        const incField = data.fields?.find(f => f.key === 'incident_type')
        if (incField?.options?.length) setIncidentOptions(incField.options)

        const natField = data.fields?.find(f => f.key === 'nationality_type')
        if (natField?.groups?.length) {
          setNationalityGroups(natField.groups)
        } else if (natField?.options?.length) {
          setNationalityOptions(natField.options)
        }
      })
      .catch(() => {}) // 失敗時はデフォルト値を使用
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) { setErr('タイトルを入力してください'); return }
    setSaving(true); setErr('')
    const ok = await updateMyReport(token, report.id, {
      title:       form.title,
      description: form.description,
      address:     form.address,
      occurred_at: form.occurred_at || null,
      source_url:  form.source_url || null,
      data: {
        incident_type:    form.incident_type,
        nationality_type: form.nationality_type,
        source_url:       form.source_url || '',
      },
    })
    setSaving(false)
    if (ok) {
      onSaved({
        title:       form.title,
        address:     form.address,
        occurred_at: form.occurred_at,
        status:      'pending',
        data: {
          incident_type:    form.incident_type,
          nationality_type: form.nationality_type,
          source_url:       form.source_url,
        },
      })
    } else {
      setErr('保存に失敗しました')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: '#0f1923', border: '1px solid #1e2d40',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>投稿を編集</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={S.label}>タイトル <span style={{ color: '#FF7043' }}>*</span></label>
            <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>詳細説明</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: 'vertical' }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={S.label}>種別</label>
              <select style={{ ...S.input, cursor: 'pointer' }} value={form.incident_type} onChange={e => set('incident_type', e.target.value)}>
                {incidentOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>関係者国籍</label>
              <select style={{ ...S.input, cursor: 'pointer' }} value={form.nationality_type} onChange={e => set('nationality_type', e.target.value)}>
                {nationalityGroups.length > 0
                  ? nationalityGroups.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </optgroup>
                    ))
                  : nationalityOptions.map(o => <option key={o} value={o}>{o}</option>)
                }
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={S.label}>発生日</label>
              <input type="date" style={S.input} value={form.occurred_at} onChange={e => set('occurred_at', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>住所</label>
              <input style={S.input} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={S.label}>ソースURL</label>
            <input style={S.input} placeholder="https://..." value={form.source_url} onChange={e => set('source_url', e.target.value)} />
          </div>
        </div>

        {err && <p style={{ color: '#f87171', fontSize: 12, margin: '12px 0 0' }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', color: '#94a3b8',
            border: '1px solid #1e2d40', borderRadius: 6, fontSize: 13, cursor: 'pointer',
          }}>
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 20px', background: '#FF7043', color: 'white',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#475569', margin: '12px 0 0' }}>
          ※ 編集後はステータスが「審査待ち」に戻ります
        </p>
      </div>
    </div>
  )
}

// ── メインページ ─────────────────────────────────────────────────────────────
export default function MyReportsPage() {
  const router = useRouter()
  const { getToken, isLoaded } = useAuth()
  const [reports, setReports]     = useState<Report[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [token, setToken]         = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Report | null>(null)
  const [deleting, setDeleting]   = useState<number | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    getToken().then(tk => {
      if (!tk) { setError('認証情報を取得できませんでした'); setLoading(false); return }
      setToken(tk)
      fetchMyReports(tk)
        .then(data => { setReports(data); setLoading(false) })
        .catch(() => { setError('データの取得に失敗しました'); setLoading(false) })
    })
  }, [isLoaded])

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!confirm('この投稿を削除しますか？この操作は取り消せません。')) return
    setDeleting(id)
    const ok = await deleteMyReport(token, id)
    setDeleting(null)
    if (ok) setReports(rs => rs.filter(r => r.id !== id))
    else alert('削除に失敗しました')
  }

  const handleSaved = (id: number, updated: Partial<Report>) => {
    setReports(rs => rs.map(r => r.id === id ? { ...r, ...updated } : r))
    setEditTarget(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', fontFamily: "'Noto Sans JP', sans-serif", color: '#e2e8f0' }}>
      {/* ヘッダー */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #1e2d40',
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#0a0f1a', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => router.push('/')} style={{
          background: 'none', border: '1px solid #1e2d40', borderRadius: 6,
          padding: '6px 12px', color: '#64748b', fontSize: 12, cursor: 'pointer',
        }}>
          ← 地図に戻る
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>マイ投稿</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>自分が投稿した情報の一覧</div>
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>読み込み中...</div>}

        {!loading && error && (
          <div style={{ background: '#EF444422', border: '1px solid #EF444466', borderRadius: 8, padding: '12px 16px', color: '#EF4444', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', padding: 64, background: '#111827', borderRadius: 12, border: '1px solid #1e2d40' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>投稿がありません</div>
            <div style={{ fontSize: 12, marginBottom: 20 }}>情報を投稿して地域の安全に貢献しましょう</div>
            <button onClick={() => router.push('/submit')} style={{ padding: '8px 20px', background: '#FF7043', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ＋ 投稿する
            </button>
          </div>
        )}

        {!loading && !error && reports.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>{reports.length} 件</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.map(r => {
                const incidentType = r.data?.incident_type || 'その他'
                const color  = INCIDENT_COLORS[incidentType] || '#6B7280'
                const status = STATUS_CONFIG[r.status || 'pending']
                return (
                  <div key={r.id} style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 10, padding: '14px 16px' }}>
                    {/* 上段：種別・ステータス・ID */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}66` }}>
                        {incidentType}
                      </span>
                      <span style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>#{r.id}</span>
                    </div>

                    {/* タイトル */}
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                      {r.title || '（タイトルなし）'}
                    </div>

                    {/* メタ情報 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: '#64748b' }}>
                      {r.occurred_at && <span>📅 {r.occurred_at}</span>}
                      {r.address     && <span>📍 {r.address}</span>}
                      {r.data?.nationality_type && <span>👤 {r.data.nationality_type}</span>}
                      {r.created_at  && <span>🕒 投稿 {new Date(r.created_at).toLocaleDateString('ja-JP')}</span>}
                    </div>

                    {/* ソースURL */}
                    {r.data?.source_url && (
                      <a href={r.data.source_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>
                        🔗 ソースを確認
                      </a>
                    )}

                    {/* 編集・削除ボタン */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: '1px solid #1e2d4066', paddingTop: 12 }}>
                      <button
                        onClick={() => setEditTarget(r)}
                        style={{
                          padding: '6px 14px', background: 'transparent',
                          color: '#60a5fa', border: '1px solid #60a5fa44',
                          borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        ✏️ 編集
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        style={{
                          padding: '6px 14px', background: 'transparent',
                          color: '#f87171', border: '1px solid #f8717144',
                          borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        {deleting === r.id ? '削除中...' : '🗑️ 削除'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 編集モーダル */}
      {editTarget && token && (
        <EditModal
          report={editTarget}
          token={token}
          onSaved={updated => handleSaved(editTarget.id, updated)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
