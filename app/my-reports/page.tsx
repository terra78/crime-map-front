'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { fetchMyReports, updateMyReport, deleteMyReport, Report } from '../lib/api'
import DatePicker from '../components/DatePicker'
import {
  getIncidentGroups,
  getCrimeCategory,
  getCrimeLaw,
  getIncidentColor,
} from '../lib/crimeTypes'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:        { label: '審査待ち',   color: '#F59E0B', bg: '#F59E0B22' },
  ai_approved:    { label: 'AI承認済み', color: '#22C55E', bg: '#22C55E22' },
  human_approved: { label: '承認済み',   color: '#22C55E', bg: '#22C55E22' },
  rejected:       { label: '却下',       color: '#EF4444', bg: '#EF444422' },
  corrected:      { label: '訂正済み',   color: '#94A3B8', bg: '#94A3B822' },
}

const FALLBACK_INCIDENT_GROUPS = getIncidentGroups()

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
type LatLng      = { lat: number; lng: number }

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
    source_url:       report.source_url ?? '',
  })
  const [saving, setSaving]                           = useState(false)
  const [err, setErr]                                 = useState('')
  const [incidentGroups, setIncidentGroups]           = useState<FieldGroup[]>(FALLBACK_INCIDENT_GROUPS)
  const [nationalityGroups, setNationalityGroups]     = useState<FieldGroup[]>([])
  const [nationalityOptions, setNationalityOptions]   = useState<string[]>([])
  const [latlng, setLatlng] = useState<LatLng | null>(
    report.lat && report.lng ? { lat: report.lat, lng: report.lng } : null
  )
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchError,  setSearchError]  = useState('')

  // 地図用 ref
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapObjRef       = useRef<any>(null)
  const markerRef       = useRef<any>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // 住所検索（Nominatim）
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim() || !mapObjRef.current) return
    setSearching(true); setSearchError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&accept-language=ja&limit=1`,
        { headers: { 'User-Agent': 'CrimeMapJapan/1.0' } }
      )
      const data = await res.json()
      if (!data.length) { setSearchError('場所が見つかりませんでした'); return }
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon)
      const L = require('leaflet')
      mapObjRef.current.setView([lat, lng], 14)
      setLatlng({ lat, lng })
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:#FF7043;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        })
      }).addTo(mapObjRef.current)
    } catch { setSearchError('検索に失敗しました') }
    finally { setSearching(false) }
  }

  // site_type から選択肢を取得（国籍はDBから、種別はフォールバック使用）
  useEffect(() => {
    fetch(`${API_BASE}/api/site_types/crime`)
      .then(r => r.json())
      .then((data: SiteTypeApi) => {
        // 種別: groups があれば setIncidentGroups、なければフォールバック
        const incField = data.fields?.find(f => f.key === 'incident_type')
        if (incField?.groups?.length) setIncidentGroups(incField.groups)
        // （フォールバックは useState 初期値として既に設定済み）

        const natField = data.fields?.find(f => f.key === 'nationality_type')
        if (natField?.groups?.length)        setNationalityGroups(natField.groups)
        else if (natField?.options?.length)  setNationalityOptions(natField.options)
      })
      .catch(() => {})
  }, [])

  // Leaflet 地図の初期化（モーダルマウント後）
  useEffect(() => {
    if (typeof window === 'undefined' || mapObjRef.current || !mapContainerRef.current) return
    const L = require('leaflet')

    const initLat = report.lat ?? 36.5
    const initLng = report.lng ?? 137.0
    const initZoom = (report.lat && report.lng) ? 13 : 5

    const map = L.map(mapContainerRef.current, { center: [initLat, initLng], zoom: initZoom })
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>', maxZoom: 18,
    }).addTo(map)

    // 既存位置にマーカーを表示
    if (report.lat && report.lng) {
      markerRef.current = L.marker([report.lat, report.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:#FF7043;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        })
      }).addTo(map)
    }

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      setLatlng({ lat, lng })
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:#FF7043;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        })
      }).addTo(map)
    })

    mapObjRef.current = map
    setTimeout(() => map.invalidateSize(), 100)

    return () => { map.remove(); mapObjRef.current = null }
  }, [])

  const handleSave = async () => {
    if (!form.title.trim()) { setErr('タイトルを入力してください'); return }
    setSaving(true); setErr('')
    const ok = await updateMyReport(token, report.id, {
      title:       form.title,
      description: form.description,
      address:     form.address,
      occurred_at: form.occurred_at || null,
      source_url:  form.source_url || null,
      lat:         latlng?.lat,
      lng:         latlng?.lng,
      data: {
        incident_type:    form.incident_type,
        crime_category:   getCrimeCategory(form.incident_type),
        crime_law:        getCrimeLaw(form.incident_type),
        nationality_type: form.nationality_type,
      },
    })
    setSaving(false)
    if (ok) {
      onSaved({
        title:       form.title,
        address:     form.address,
        occurred_at: form.occurred_at,
        source_url:  form.source_url || undefined,
        status:      'pending',
        lat:         latlng?.lat ?? report.lat,
        lng:         latlng?.lng ?? report.lng,
        data: {
          incident_type:    form.incident_type,
          nationality_type: form.nationality_type,
        },
      })
    } else {
      setErr('保存に失敗しました')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 9999, padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#0f1923', border: '1px solid #1e2d40',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 520,
        marginTop: 'auto', marginBottom: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>投稿を編集</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* タイトル */}
          <div>
            <label style={S.label}>タイトル <span style={{ color: '#FF7043' }}>*</span></label>
            <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          {/* 詳細説明 */}
          <div>
            <label style={S.label}>詳細説明</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: 'vertical' }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* 種別・国籍 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={S.label}>種別</label>
              <select style={{ ...S.input, cursor: 'pointer' }} value={form.incident_type} onChange={e => set('incident_type', e.target.value)}>
                {incidentGroups.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
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

          {/* 発生日・住所 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={S.label}>発生日</label>
              <DatePicker value={form.occurred_at} onChange={v => set('occurred_at', v)} />
            </div>
            <div>
              <label style={S.label}>住所</label>
              <input style={S.input} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>

          {/* 発生場所（地図） */}
          <div>
            {/* 住所検索バー */}
            <label style={{ ...S.label, marginBottom: 6 }}>📍 住所で地図を移動</label>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                style={{ ...S.input, flex: 1, minWidth: 0 }}
                placeholder="例: 東京都新宿区、大阪城、渋谷駅..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" disabled={searching} style={{
                padding: '8px 16px', background: '#1e3a5f', color: '#4FC3F7',
                border: '1px solid #4FC3F744', borderRadius: 6, fontSize: 13,
                cursor: searching ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600,
              }}>
                {searching ? '検索中…' : '🔍 検索'}
              </button>
            </form>
            {searchError && <p style={{ color: '#f87171', fontSize: 11, margin: '-4px 0 6px' }}>{searchError}</p>}
            <label style={S.label}>
              地図をクリックして発生場所を更新
              {latlng && (
                <span style={{ color: '#4FC3F7', marginLeft: 8 }}>
                  ✓ {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}
                </span>
              )}
            </label>
            <div
              ref={mapContainerRef}
              style={{
                width: '100%', height: 220, borderRadius: 8,
                border: `1px solid ${latlng ? '#4FC3F7' : '#1e2d40'}`,
                overflow: 'hidden',
              }}
            />
          </div>

          {/* ソースURL */}
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
      </div>
    </div>
  )
}

// ── メインページ（内側）─────────────────────────────────────────────────────
function MyReportsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editParam = searchParams.get('edit')   // ?edit={id} でモーダルを自動オープン

  const { getToken, isLoaded } = useAuth()
  const [reports, setReports]       = useState<Report[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [token, setToken]           = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Report | null>(null)
  const [deleting, setDeleting]     = useState<number | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    getToken().then(tk => {
      if (!tk) { setError('認証情報を取得できませんでした'); setLoading(false); return }
      setToken(tk)
      fetchMyReports(tk)
        .then(data => {
          setReports(data)
          setLoading(false)
          // ?edit={id} があれば対象レポートのモーダルを自動オープン
          if (editParam) {
            const target = data.find(r => r.id === Number(editParam))
            if (target) setEditTarget(target)
          }
        })
        .catch(() => { setError('データの取得に失敗しました'); setLoading(false) })
    })
  }, [isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

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
                const incidentType = r.data?.incident_type || 'その他刑法犯'
                const color  = getIncidentColor(incidentType)
                const status = STATUS_CONFIG[r.status || 'pending']
                const isCorrected = r.status === 'corrected'
                return (
                  <div key={r.id} style={{ position: 'relative', background: '#111827', border: '1px solid #1e2d40', borderRadius: 10, padding: '14px 16px' }}>
                    {/* 訂正済みオーバーレイ */}
                    {isCorrected && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 10,
                        background: 'rgba(0,0,0,0.55)', zIndex: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                      }}>
                        <div style={{
                          fontSize: 18, fontWeight: 700, color: '#94a3b8',
                          border: '2px solid #475569', borderRadius: 8,
                          padding: '6px 18px', transform: 'rotate(-12deg)',
                          letterSpacing: '0.12em', userSelect: 'none',
                        }}>訂正済み</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}66` }}>
                        {incidentType}
                      </span>
                      <span style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>#{r.id}</span>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                      {r.title || '（タイトルなし）'}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: '#64748b' }}>
                      {r.occurred_at && <span>📅 {r.occurred_at}</span>}
                      {r.address     && <span>📍 {r.address}</span>}
                      {r.data?.nationality_type && <span>👤 {r.data.nationality_type}</span>}
                      {r.created_at  && <span>🕒 投稿 {new Date(r.created_at).toLocaleDateString('ja-JP')}</span>}
                    </div>

                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>
                        🔗 ソースを確認
                      </a>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: '1px solid #1e2d4066', paddingTop: 12 }}>
                      <button
                        onClick={() => setEditTarget(r)}
                        style={{ padding: '6px 14px', background: 'transparent', color: '#60a5fa', border: '1px solid #60a5fa44', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                      >
                        ✏️ 編集
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        style={{ padding: '6px 14px', background: 'transparent', color: '#f87171', border: '1px solid #f8717144', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
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

// ── エクスポート（Suspense バウンダリで useSearchParams をラップ）────────────
export default function MyReportsPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#0a0f1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif",
      }}>
        読み込み中...
      </div>
    }>
      <MyReportsPageInner />
    </Suspense>
  )
}
