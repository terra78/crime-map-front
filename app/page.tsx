'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import { fetchReports, Report } from './lib/api'
import Sidebar from './components/Sidebar'

// Leafletはサーバーサイドレンダリング不可なのでdynamic import
const Map = dynamic(() => import('./components/Map'), { ssr: false })

export default function Home() {
  const [allReports, setAllReports]   = useState<Report[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState({
    incident_type: '全て',
    nationality_type: '全て',
  })

  // 初回データ取得
  useEffect(() => {
    fetchReports({ site_type_id: 1 }).then(data => {
      setAllReports(data)
      setLoading(false)
    })
  }, [])

  // フィルタリング
  const filteredReports = allReports.filter(r => {
    if (filter.incident_type !== '全て' && r.data?.incident_type !== filter.incident_type) return false
    if (filter.nationality_type !== '全て' && r.data?.nationality_type !== filter.nationality_type) return false
    return true
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0f1a',
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      {/* サイドバー */}
      <Sidebar
        reports={filteredReports}
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* 地図エリア（サイドバーの右側） */}
      <div style={{
        position: 'absolute', inset: 0,
        marginLeft: '280px',
        transition: 'margin-left 0.25s ease',
      }}>
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#64748b', fontSize: 14,
          }}>
            <div>データを読み込み中...</div>
          </div>
        ) : (
          <Map reports={filteredReports} />
        )}
      </div>

      {/* 右上：投稿ボタン */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1001,
      }}>
        <a href="/submit" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px',
          background: '#FF7043', color: 'white',
          borderRadius: 6, textDecoration: 'none',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 2px 12px rgba(255,112,67,0.4)',
        }}>
          ＋ 投稿する
        </a>
      </div>

      {/* 右下：データについて */}
      <div style={{
        position: 'absolute', bottom: 32, right: 16, zIndex: 1001,
        fontSize: 10, color: '#334155', textAlign: 'right',
      }}>
        ※ ユーザー投稿および公開情報に基づくデータです
      </div>
    </div>
  )
}
