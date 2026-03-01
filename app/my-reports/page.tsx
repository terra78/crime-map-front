'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { fetchMyReports, Report } from '../lib/api'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故':       '#F59E0B',
  '窃盗・万引き':   '#EF4444',
  '暴行・傷害':     '#DC2626',
  '詐欺':           '#8B5CF6',
  '薬物':           '#EC4899',
  '性犯罪':         '#F97316',
  '殺人・傷害致死': '#B91C1C',
  '不法滞在・入管違反': '#6366F1',
  'その他':         '#6B7280',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:        { label: '審査待ち',    color: '#F59E0B', bg: '#F59E0B22' },
  ai_approved:    { label: 'AI承認済み',  color: '#22C55E', bg: '#22C55E22' },
  human_approved: { label: '承認済み',    color: '#22C55E', bg: '#22C55E22' },
  rejected:       { label: '却下',        color: '#EF4444', bg: '#EF444422' },
}

export default function MyReportsPage() {
  const router = useRouter()
  const { getToken, isLoaded } = useAuth()
  const [reports, setReports]   = useState<Report[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!isLoaded) return
    getToken().then(token => {
      if (!token) { setError('認証情報を取得できませんでした'); setLoading(false); return }
      fetchMyReports(token)
        .then(data => { setReports(data); setLoading(false) })
        .catch(() => { setError('データの取得に失敗しました'); setLoading(false) })
    })
  }, [isLoaded])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1a',
      fontFamily: "'Noto Sans JP', sans-serif",
      color: '#e2e8f0',
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e2d40',
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#0a0f1a',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: '1px solid #1e2d40',
            borderRadius: 6, padding: '6px 12px',
            color: '#64748b', fontSize: 12, cursor: 'pointer',
          }}
        >
          ← 地図に戻る
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>マイ投稿</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>自分が投稿した情報の一覧</div>
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 48 }}>
            読み込み中...
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: '#EF444422', border: '1px solid #EF444466',
            borderRadius: 8, padding: '12px 16px', color: '#EF4444', fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div style={{
            textAlign: 'center', color: '#475569', padding: 64,
            background: '#111827', borderRadius: 12, border: '1px solid #1e2d40',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>投稿がありません</div>
            <div style={{ fontSize: 12, marginBottom: 20 }}>情報を投稿して地域の安全に貢献しましょう</div>
            <button
              onClick={() => router.push('/submit')}
              style={{
                padding: '8px 20px', background: '#FF7043', color: 'white',
                border: 'none', borderRadius: 6, fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              ＋ 投稿する
            </button>
          </div>
        )}

        {!loading && !error && reports.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
              {reports.length} 件
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.map(r => {
                const incidentType = r.data?.incident_type || 'その他'
                const color  = INCIDENT_COLORS[incidentType] || '#6B7280'
                const status = STATUS_CONFIG[r.status || 'pending']
                return (
                  <div key={r.id} style={{
                    background: '#111827',
                    border: '1px solid #1e2d40',
                    borderRadius: 10,
                    padding: '14px 16px',
                  }}>
                    {/* 上段：種別バッジ + ステータスバッジ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        padding: '2px 8px', fontSize: 11, borderRadius: 4,
                        background: `${color}22`, color, border: `1px solid ${color}66`,
                      }}>
                        {incidentType}
                      </span>
                      <span style={{
                        padding: '2px 8px', fontSize: 11, borderRadius: 4,
                        background: status.bg, color: status.color,
                      }}>
                        {status.label}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
                        #{r.id}
                      </span>
                    </div>

                    {/* タイトル */}
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                      {r.title || '（タイトルなし）'}
                    </div>

                    {/* メタ情報 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: '#64748b' }}>
                      {r.occurred_at && (
                        <span>📅 {r.occurred_at}</span>
                      )}
                      {r.address && (
                        <span>📍 {r.address}</span>
                      )}
                      {r.data?.nationality_type && (
                        <span>👤 {r.data.nationality_type}</span>
                      )}
                      {r.created_at && (
                        <span>🕒 投稿 {new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
                      )}
                    </div>

                    {/* ソースURL */}
                    {r.data?.source_url && (
                      <a
                        href={r.data.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block', marginTop: 8,
                          fontSize: 11, color: '#60a5fa', textDecoration: 'none',
                        }}
                      >
                        🔗 ソースを確認
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
