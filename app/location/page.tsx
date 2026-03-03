'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Report } from '../lib/api'
import { formatDate } from '../components/Map'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故': '#F59E0B',
  '窃盗':    '#EF4444',
  '暴行':    '#DC2626',
  '詐欺':    '#8B5CF6',
  'その他':  '#6B7280',
}

export default function LocationPage() {
  const router  = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [address, setAddress] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('crime-map-group')
      if (!raw) return
      const { reports: rs, address: addr } = JSON.parse(raw)
      // 発生日時の降順でソートして最大100件
      const sorted = [...(rs as Report[])].sort((a, b) => {
        const da = a.occurred_at || ''
        const db = b.occurred_at || ''
        return db.localeCompare(da)
      })
      setReports(sorted.slice(0, 100))
      setAddress(addr || '')
    } catch {}
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      color: '#e2e8f0',
      fontFamily: "'Noto Sans JP', sans-serif",
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => { window.close(); router.back() }}
            style={{
              background: 'none', border: '1px solid #1e2d40', borderRadius: 6,
              padding: '6px 12px', color: '#64748b', fontSize: 12,
              cursor: 'pointer', flexShrink: 0,
            }}
          >← 閉じる</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>同一地点の事件一覧</div>
            {address && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>📍 {address}</div>
            )}
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {reports.length}件 ／ 最新の発生日時順
            </div>
          </div>
        </div>

        {/* カードグリッド */}
        {reports.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}>
            {reports.map(r => {
              const color   = INCIDENT_COLORS[r.data?.incident_type || ''] || '#6B7280'
              const nation  = r.data?.nationality_type || '不明'
              const dateLbl = formatDate(r.occurred_at)
              return (
                <div key={r.id} style={{
                  background: '#111827',
                  border: '1px solid #1e2d40',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}>
                  <div style={{
                    display: 'inline-block', padding: '2px 8px',
                    background: `${color}33`, color,
                    border: `1px solid ${color}66`,
                    borderRadius: 4, fontSize: 11, marginBottom: 8,
                  }}>{r.data?.incident_type || 'その他'}</div>

                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    marginBottom: 4, lineHeight: 1.4,
                  }}>{r.title || '（タイトルなし）'}</div>

                  {r.address && (
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                      📍 {r.address}
                    </div>
                  )}
                  {dateLbl && (
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                      📅 {dateLbl}
                    </div>
                  )}

                  <div style={{ fontSize: 11 }}>
                    <span style={{
                      padding: '1px 6px',
                      background: nation === '外国人' ? '#FF704333' : '#4FC3F733',
                      color:      nation === '外国人' ? '#FF7043'   : '#4FC3F7',
                      borderRadius: 4,
                    }}>{nation}</span>
                  </div>

                  {r.source_url && (
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block', marginTop: 8,
                        fontSize: 11, color: '#60a5fa', textDecoration: 'none',
                      }}
                    >🔗 ソースを確認</a>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: 80, fontSize: 14 }}>
            データが見つかりません。地図からピンをクリックして開いてください。
          </div>
        )}

      </div>
    </div>
  )
}
