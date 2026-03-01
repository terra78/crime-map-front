'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import DatePicker from '../components/DatePicker'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type FieldGroup = { label: string; options: string[] }

type FieldDef = {
  key:     string
  label:   string
  type:    string
  options?: string[]
  groups?:  FieldGroup[]
}

type SiteType = {
  id:     number
  slug:   string
  name:   string
  fields: FieldDef[]
}

type LatLng = { lat: number; lng: number }

export default function SubmitPage() {
  const router = useRouter()
  const { getToken, isSignedIn } = useAuth()
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  const [siteType, setSiteType] = useState<SiteType | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [form, setForm] = useState({
    title:            '',
    description:      '',
    incident_type:    '',
    nationality_type: '日本',
    source_url:       '',
    occurred_at:      '',
    address:          '',
  })
  const [latlng,     setLatlng]     = useState<LatLng | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState(false)

  // DBからsite_type取得
  useEffect(() => {
    fetch(`${API_BASE}/api/site_types/crime`)
      .then(r => r.json())
      .then((data: SiteType) => {
        setSiteType(data)
        const incidentField = data.fields?.find(f => f.key === 'incident_type')
        if (incidentField?.options?.[0]) {
          setForm(f => ({ ...f, incident_type: incidentField.options![0] }))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // 地図初期化（ローディング完了後）
  useEffect(() => {
    if (typeof window === 'undefined' || mapObjRef.current || loading) return
    const L = require('leaflet')

    const map = L.map(mapRef.current!, { center: [36.5, 137.0], zoom: 5 })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19,
    }).addTo(map)

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
  }, [loading])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    if (!latlng)     { setError('地図上で発生場所をクリックしてください'); return }
    if (!form.title) { setError('タイトルを入力してください'); return }
    setError(''); setSubmitting(true)
    try {
      const token = isSignedIn ? await getToken() : null
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${API_BASE}/api/reports`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          site_type_id:  siteType?.id ?? 1,
          title:         form.title,
          description:   form.description,
          lat:           latlng.lat,
          lng:           latlng.lng,
          address:       form.address,
          occurred_at:   form.occurred_at || null,
          source_url:    form.source_url || null,
          data: {
            incident_type:    form.incident_type,
            nationality_type: form.nationality_type,
            source_url:       form.source_url || null,
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

  // DBから取得したフィールド
  const incidentField     = siteType?.fields?.find(f => f.key === 'incident_type')
  const incidentOptions   = incidentField?.options ?? []
  const nationalityField  = siteType?.fields?.find(f => f.key === 'nationality_type')
  const nationalityGroups = nationalityField?.groups ?? []

  const S = {
    page:         { minHeight: '100vh', background: '#0a0f1a', color: '#e2e8f0', fontFamily: "'Noto Sans JP', sans-serif", padding: '24px 16px' } as React.CSSProperties,
    container:    { maxWidth: 680, margin: '0 auto' } as React.CSSProperties,
    card:         { background: '#111827', border: '1px solid #1e2d40', borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
    label:        { fontSize: 11, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
    input:        { width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40', borderRadius: 6, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
    textarea:     { width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40', borderRadius: 6, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const },
    select:       { width: '100%', background: '#0a0f1a', border: '1px solid #1e2d40', borderRadius: 6, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', cursor: 'pointer' },
    row:          { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
    sectionTitle: { fontSize: 12, color: '#FF7043', marginBottom: 14, fontWeight: 600 },
  }

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

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b' }}>読み込み中...</div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: '1px solid #1e2d40', borderRadius: 6, padding: '6px 12px', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
            ← 地図に戻る
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>情報を投稿する</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>ソースURLがある場合はAIが自動審査します</div>
          </div>
        </div>

        {/* 基本情報 */}
        <div style={S.card}>
          <div style={S.sectionTitle}>■ 基本情報</div>
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
                {incidentOptions.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>関係者国籍</label>
              <select style={S.select} value={form.nationality_type} onChange={e => set('nationality_type', e.target.value)}>
                {nationalityGroups.length > 0
                  ? nationalityGroups.map(g => (
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
          <div style={S.sectionTitle}>■ 日時・場所</div>
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
          <label style={S.label}>
            発生場所を地図上でクリックして選択
            {latlng && <span style={{ color: '#4FC3F7', marginLeft: 8 }}>✓ {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}</span>}
          </label>
          <div ref={mapRef} style={{ width: '100%', height: 280, borderRadius: 8, border: `1px solid ${latlng ? '#4FC3F7' : '#1e2d40'}`, overflow: 'hidden' }} />
        </div>

        {/* ソース */}
        <div style={S.card}>
          <div style={S.sectionTitle}>■ 情報ソース</div>
          <label style={S.label}>ソースURL（推奨）</label>
          <input style={S.input} placeholder="https://..." value={form.source_url} onChange={e => set('source_url', e.target.value)} />
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>ニュース記事等のURLを入力するとAIが自動審査します</div>
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

        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '14px', background: submitting ? '#374151' : '#FF7043', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 4px 16px rgba(255,112,67,0.4)' }}>
          {submitting ? '送信中...' : '投稿する'}
        </button>

      </div>
    </div>
  )
}
