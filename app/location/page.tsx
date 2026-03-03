'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { Report } from '../lib/api'
import ReportCard from '../components/ReportCard'

// ThreadPanel は Leaflet 依存なので dynamic import
const ThreadPanel = dynamic(() => import('../components/ThreadPanel'), { ssr: false })

export default function LocationPage() {
  const router  = useRouter()
  const { userId, getToken } = useAuth()
  const { user }             = useUser()
  const [reports, setReports]           = useState<Report[]>([])
  const [address, setAddress]           = useState('')
  const [threadReport, setThreadReport] = useState<Report | null>(null)

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
      position: 'relative',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        // コメントパネルが開いているときは右側を確保
        paddingRight: threadReport ? 360 : 0,
        transition: 'padding-right 0.2s ease',
      }}>

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

        {/* カードグリッド（共通 ReportCard を使用） */}
        {reports.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}>
            {reports.map(r => (
              <ReportCard
                key={r.id}
                report={r}
                currentUserId={userId ?? null}
                isLoggedIn={!!userId}
                isAdmin={false}
                onOpenThread={r => setThreadReport(r)}
                width="100%"
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: 80, fontSize: 14 }}>
            データが見つかりません。地図からピンをクリックして開いてください。
          </div>
        )}

      </div>

      {/* コメントスライドパネル */}
      {threadReport && (
        <ThreadPanel
          report={threadReport}
          onClose={() => setThreadReport(null)}
          currentUserId={userId ?? null}
          currentUserName={user?.fullName ?? null}
          currentUserAvatar={user?.imageUrl ?? null}
          getToken={getToken}
        />
      )}
    </div>
  )
}
