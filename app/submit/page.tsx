'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import DatePicker from '../components/DatePicker'
import { getIncidentGroups, getCrimeCategory, getCrimeLaw } from '../lib/crimeTypes'
import { fetchReportById } from '../lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type FieldGroup = { label: string; options: string[] }
type FieldDef   = { key: string; label: string; type: string; options?: string[]; groups?: FieldGroup[] }
type SiteType   = { id: number; slug: string; name: string; fields: FieldDef[] }
const FALLBACK_INCIDENT_GROUPS = getIncidentGroups()
type LatLng = { lat: number; lng: number }

const MARKER_HTML = `<div style="width:24px;height:24px;background:#FF7043;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`

function SubmitPageInner() {
  const router            = useRouter()
  const searchParams      = useSearchParams()
  const { getToken, isSignedIn } = useAuth()
  const mapRef            = useRef<HTMLDivElement>(null)
  const mapObjRef         = useRef<any>(null)
  const markerRef         = useRef<any>(null)

  // 訂正申請モード: ?correct={originalId}
  const correctId = searchParams.get('correct')
  const isCorrectMode = !!correctId
  const [correctLoading, setCorrectLoading] = useState(isCorrectMode)

  // ── モード ──────────────────────────────────────────────────────────────────
  const [mode, setMode]           = useState<'url' | 'manual'>('url')

  // URL モード
  const [urlInput,     setUrlInput]     = useState('')
  const [extracting,   setExtracting]   = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extracted,    setExtracted]    = useState(false)

  // フォーム共通
  const [siteType,   setSiteType]   = useState<SiteType | null>(null)
  const [form, setForm] = useState({
    title:            '',
    description:      '',
    incident_type:    FALLBACK_INCIDENT_GROUPS[0]?.options?.[0] ?? '',
    nationality_type: '日本',
    source_url:       '',
    occurred_at:      '',
    address:          '',
  })
  const [latlng,     setLatlng]     = useState<LatLng | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchError,  setSearchError]  = useState('')

  // 地図とフォームを表示するか
  const mapNeeded = mode === 'manual' || extracted

  // ── DB からサイトタイプ取得 ───────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/api/site_types/crime`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: SiteType) => {
        setSiteType(data)
        const f = data.fields?.find(f => f.key === 'incident_type')
        const first = f?.groups?.[0]?.options?.[0] || f?.options?.[0]
        if (first) setForm(p => ({ ...p, incident_type: first }))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  // ── 訂正申請モード: 元投稿データを取得してフォームを初期化 ────────────────
  useEffect(() => {
    if (!isCorrectMode || !correctId) return
    setCorrectLoading(true)
    fetchReportById(Number(correctId))
      .then(data => {
        if (!data) { setError('元の投稿が見つかりませんでした'); return }
        setForm(f => ({
          ...f,
          title:            data.title            || '',
          description:      (data as any).description || '',
          incident_type:    data.data?.incident_type     || f.incident_type,
          nationality_type: data.data?.nationality_type  || '日本',
          source_url:       data.source_url        || '',
          occurred_at:      data.occurred_at       || '',
          address:          data.address           || '',
        }))
        if (data.lat && data.lng) setLatlng({ lat: data.lat, lng: data.lng })
        setExtracted(true)
        setMode('manual')
      })
      .catch(() => setError('元の投稿の取得に失敗しました'))
      .finally(() => setCorrectLoading(false))
  }, [isCorrectMode, correctId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 地図の初期化 + マーカー更新（mapNeeded / latlng が変わるたびに実行）──
  useEffect(() => {
    if (!mapNeeded || !mapRef.current || typeof window === 'undefined') return
    const L = require('leaflet')
    const mkIcon = () => L.divIcon({ className: '', html: MARKER_HTML, iconSize: [24, 24], iconAnchor: [12, 12] })

    if (!mapObjRef.current) {
      // 初回: 地図を作成
      const map = L.map(mapRef.current, { center: [36.5, 137.0], zoom: 5 })
      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
        maxZoom: 18,
      }).addTo(map)
      map.on('click', (e: any) => setLatlng({ lat: e.latlng.lat, lng: e.latlng.lng }))
      mapObjRef.current = map
    } else {
      // 再表示時: サイズを再計算
      setTimeout(() => mapObjRef.current?.invalidateSize(), 50)
    }

    // マーカー更新
    if (latlng) {
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([latlng.lat, latlng.lng], { icon: mkIcon() }).addTo(mapObjRef.current)
      mapObjRef.current.setView([latlng.lat, latlng.lng], 13)
    }
  }, [mapNeeded, latlng])  // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  // ── URL 解析 ─────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    const url = urlInput.trim()
    if (!url) return
    setExtracting(true); setExtractError('')
    try {
      const res  = await fetch(`${API_BASE}/api/reports/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) { setExtractError(data.error); return }

      setForm(f => ({
        ...f,
        title:            data.title            || '',
        description:      data.description      || '',
        incident_type:    data.incident_type     || f.incident_type,
        nationality_type: data.nationality_type  || '日本',
        source_url:       data.source_url        || url,
        occurred_at:      data.occurred_at       || '',
        address:          data.address           || '',
      }))
      if (data.lat && data.lng) setLatlng({ lat: data.lat, lng: data.lng })
      setExtracted(true)
    } catch {
      setExtractError('解析に失敗しました。URLを確認して再試行してください。')
    } finally {
      setExtracting(false)
    }
  }

  // やり直す
  const handleReset = () => {
    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }
    if (mapObjRef.current) { mapObjRef.current.remove(); mapObjRef.current = null }
    setLatlng(null); setExtracted(false); setExtractError('')
    setForm(f => ({ ...f, title: '', description: '', source_url: '', occurred_at: '', address: '' }))
  }

  // ── 住所検索 ────────────────────────────────────────────────────────────
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!searchQuery.trim() || !mapObjRef.current) return
    setSearching(true); setSearchError('')
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&accept-language=ja&limit=1`,
        { headers: { 'User-Agent': 'CrimeMapJapan/1.0' } }
      )
      const data = await res.json()
      if (!data.length) { setSearchError('場所が見つかりませんでした'); return }
      setLatlng({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
    } catch { setSearchError('検索に失敗しました') }
    finally   { setSearching(false) }
  }

  // ── 投稿送信 ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!latlng)     { setError('地図上で発生場所をクリックしてください'); return }
    if (!form.title) { setError('タイトルを入力してください'); return }
    setError(''); setSubmitting(true)
    try {
      const token   = isSignedIn ? await getToken() : null
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const extraData = isCorrectMode && correctId
        ? { original_report_id: Number(correctId) }
        : {}

      const res = await fetch(`${API_BASE}/api/reports`, {
        method: 'POST', headers,
        body: JSON.stringify({
          site_type_id: siteType?.id ?? 1,
          title:        form.title,
          description:  form.description,
          lat:          latlng.lat,
          lng:          latlng.lng,
          address:      form.address,
          occurred_at:  form.occurred_at || null,
          source_url:   form.source_url  || null,
          data: {
            incident_type:    form.incident_type,
            crime_category:   getCrimeCategory(form.incident_type),
            crime_law:        getCrimeLaw(form.incident_type),
            nationality_type: form.nationality_type,
            ...extraData,
          },
        }),
      })
      if (!res.ok) throw new Error()
      setSuccess(true)
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  const incidentGroups   = siteType?.fields?.find(f => f.key === 'incident_type')?.groups?.length
    ? siteType!.fields.find(f => f.key === 'incident_type')!.groups!
    : FALLBACK_INCIDENT_GROUPS
  const nationalityField = siteType?.fields?.find(f => f.key === 'nationality_type')

  // ── スタイル定数 ─────────────────────────────────────────────────────────
  const S = {
    page:      { minHeight: '100vh', background: '#0a0f1a', color: '#e2e8f0', fontFamily: "'Noto Sans JP', sans-serif", padding: '24px 16px' } as React.CSSProperties,
    container: { maxWidth: 680, margin: '0 auto' } as React.CSSProperties,
    card:      { background: '#111827', border: '1px solid #1e2d40', borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
    label:     { fontSize: 11, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
    input:     { width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40', borderRadius: 6, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
    textarea:  { width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40', borderRadius: 6, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const },
    select:    { width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40', borderRadius: 6, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: 'pointer' },
    row:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
    secTitle:  { fontSize: 12, color: '#FF7043', marginBottom: 14, fontWeight: 600 },
  }

  // ── 訂正モード読み込み中 ────────────────────────────────────────────────
  if (correctLoading) return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif" }}>
      元の投稿を読み込み中...
    </div>
  )

  // ── 成功画面 ─────────────────────────────────────────────────────────────
  if (success) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>投稿を受け付けました</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>内容を確認後、審査が通り次第マップに表示されます</div>
        <button onClick={() => router.push('/')} style={{ background: '#FF7043', color: 'white', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          地図に戻る
        </button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #1e2d40', borderRadius: 6, padding: '6px 12px', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
            ← 戻る
          </button>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {isCorrectMode ? '📝 訂正申請' : '情報を投稿する'}
          </div>
          {isCorrectMode && (
            <span style={{ fontSize: 11, color: '#fbbf24', background: '#fbbf2420', border: '1px solid #fbbf2440', borderRadius: 4, padding: '2px 8px' }}>
              #{correctId} の訂正
            </span>
          )}
        </div>

        {/* 訂正申請バナー */}
        {isCorrectMode && (
          <div style={{ background: '#1a1400', border: '1px solid #fbbf2444', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#fbbf24' }}>
            📝 <strong>訂正申請モード</strong> — 元の投稿内容を修正して送信してください。管理者が承認すると元の投稿は「訂正済み」になります。
          </div>
        )}

        {/* モード切替タブ */}
        <div style={{ display: 'flex', background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: 4, marginBottom: 20, gap: 4 }}>
          {([
            { key: 'url',    label: '🔗 ソースURLから投稿' },
            { key: 'manual', label: '✏️ 手動で入力' },
          ] as const).map(({ key, label }) => (
            <button key={key}
              onClick={() => { setMode(key); setError(''); setExtractError('') }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                background: mode === key ? '#FF7043' : 'transparent',
                color:      mode === key ? 'white'   : '#64748b',
                fontSize: 13, fontWeight: mode === key ? 700 : 400,
              }}
            >{label}</button>
          ))}
        </div>

        {/* ── URL モード Phase 1: URL入力 ─────────────────────────────────── */}
        {mode === 'url' && !extracted && (
          <div style={S.card}>
            <div style={S.secTitle}>■ ニュース記事のURLを貼り付け</div>
            <label style={S.label}>ソースURL</label>
            <input
              style={{ ...S.input, fontSize: 14 }}
              placeholder="https://..."
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setExtractError('') }}
              onKeyDown={e => e.key === 'Enter' && !extracting && urlInput.trim() && handleExtract()}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6, marginBottom: 16 }}>
              ニュース記事のURLを貼り付けると、AIがタイトル・場所・国籍・種別などを自動で抽出します
            </div>

            {extractError && (
              <div style={{ background: '#FF704322', border: '1px solid #FF704366', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#FF7043' }}>
                {extractError}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={extracting || !urlInput.trim()}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: extracting || !urlInput.trim() ? 'not-allowed' : 'pointer',
                background: extracting || !urlInput.trim() ? '#374151' : '#FF7043',
                color: 'white',
                boxShadow: extracting ? 'none' : '0 4px 16px rgba(255,112,67,0.4)',
              }}
            >
              {extracting ? '🤖 解析中...' : '✨ URLから情報を取得'}
            </button>

            {extracting && (
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                記事を取得してAIで解析しています<br />
                10〜30秒ほどかかる場合があります…
              </div>
            )}
          </div>
        )}

        {/* ── フォーム（URL解析完了後 or 手動モード）─────────────────────────── */}
        {mapNeeded && (
          <>
            {/* 解析完了バナー（URLモードのみ） */}
            {mode === 'url' && extracted && (
              <div style={{ background: '#0a2e1a', border: '1px solid #22c55e55', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✅ AIが情報を抽出しました</span>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>内容を確認・修正してから投稿してください</div>
                </div>
                <button onClick={handleReset} style={{ background: 'none', border: '1px solid #374151', borderRadius: 4, padding: '5px 12px', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>
                  やり直す
                </button>
              </div>
            )}

            {/* 基本情報 */}
            <div style={S.card}>
              <div style={S.secTitle}>■ 基本情報</div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>タイトル <span style={{ color: '#FF7043' }}>*</span></label>
                <input style={S.input} placeholder="例: ○○市で窃盗事件" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>詳細説明</label>
                <textarea style={S.textarea} placeholder="事件の詳細を入力（任意）" value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div style={S.row}>
                <div>
                  <label style={S.label}>種別</label>
                  <select style={S.select} value={form.incident_type} onChange={e => set('incident_type', e.target.value)}>
                    {incidentGroups.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={S.label}>関係者国籍</label>
                  <select style={S.select} value={form.nationality_type} onChange={e => set('nationality_type', e.target.value)}>
                    {nationalityField?.groups?.length
                      ? nationalityField.groups.map(g => (
                          <optgroup key={g.label} label={g.label}>
                            {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </optgroup>
                        ))
                      : nationalityField?.options?.map(o => <option key={o} value={o}>{o}</option>)
                    }
                  </select>
                </div>
              </div>
            </div>

            {/* 日時・場所 */}
            <div style={S.card}>
              <div style={S.secTitle}>■ 日時・場所</div>
              <div style={S.row}>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>発生日</label>
                  <DatePicker value={form.occurred_at} onChange={v => set('occurred_at', v)} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>住所（任意）</label>
                  <input style={S.input} placeholder="例: 東京都新宿区" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>
              </div>

              <label style={{ ...S.label, marginBottom: 6 }}>📍 住所で地図を移動（任意）</label>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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
              {searchError && <p style={{ color: '#f87171', fontSize: 11, margin: '-8px 0 8px' }}>{searchError}</p>}

              <label style={S.label}>
                発生場所を地図上でクリックして選択
                {latlng && <span style={{ color: '#4FC3F7', marginLeft: 8 }}>✓ {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}</span>}
              </label>
              <div
                ref={mapRef}
                style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden', border: `1px solid ${latlng ? '#4FC3F7' : '#1e2d40'}` }}
              />
            </div>

            {/* ソースURL */}
            <div style={S.card}>
              <div style={S.secTitle}>■ 情報ソース</div>
              <label style={S.label}>ソースURL{mode === 'url' ? '（解析元・変更不可）' : '（推奨）'}</label>
              <input
                style={{ ...S.input, ...(mode === 'url' && extracted ? { color: '#64748b', cursor: 'default' } : {}) }}
                placeholder="https://..."
                value={form.source_url}
                onChange={e => set('source_url', e.target.value)}
                readOnly={mode === 'url' && extracted}
              />
              {mode === 'manual' && (
                <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>ニュース記事等のURLを入力するとAIが自動審査します</div>
              )}
            </div>

            {/* 注意事項 */}
            <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: '#64748b' }}>
              ※ 個人を特定できる情報の投稿は禁止です。虚偽情報・差別的表現を含む投稿は削除されます。
            </div>

            {error && (
              <div style={{ background: '#FF704322', border: '1px solid #FF704366', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#FF7043' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', padding: '14px', border: 'none', borderRadius: 8,
                fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? '#374151' : (isCorrectMode ? '#d97706' : '#FF7043'),
                color: 'white',
                boxShadow: submitting ? 'none' : (isCorrectMode ? '0 4px 16px rgba(217,119,6,0.4)' : '0 4px 16px rgba(255,112,67,0.4)'),
              }}
            >
              {submitting ? '送信中...' : (isCorrectMode ? '📝 訂正申請を送信' : '投稿する')}
            </button>
          </>
        )}

      </div>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14, fontFamily: "'Noto Sans JP', sans-serif" }}>
        読み込み中...
      </div>
    }>
      <SubmitPageInner />
    </Suspense>
  )
}
