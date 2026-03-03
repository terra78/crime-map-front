'use client'

import { Report, adminDeleteReport } from '../lib/api'
import { formatDate } from './Map'
import { getNationalityColor } from '../lib/nationalityData'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故': '#F59E0B',
  '窃盗':    '#EF4444',
  '暴行':    '#DC2626',
  '詐欺':    '#8B5CF6',
  'その他':  '#6B7280',
}

type Props = {
  report: Report
  /** ログイン中のユーザーID（未ログインなら null） */
  currentUserId?: string | null
  /** ログイン済みかどうか（訂正申請ボタン表示制御） */
  isLoggedIn?: boolean
  /** 管理者モード */
  isAdmin?: boolean
  adminToken?: string | null
  /** 管理者が削除した後に呼ばれるコールバック */
  onAdminDelete?: (id: number) => void
  /** コメントボタン押下時（ThreadPanel を開く） */
  onOpenThread?: (r: Report) => void
  /** 親パネルを閉じるコールバック（GroupPanel 等） */
  onClose?: () => void
  /** カード幅（デフォルト 250px） */
  width?: number | string
}

export default function ReportCard({
  report: r,
  currentUserId,
  isLoggedIn = false,
  isAdmin = false,
  adminToken,
  onAdminDelete,
  onOpenThread,
  onClose,
  width = 250,
}: Props) {
  const color      = INCIDENT_COLORS[r.data?.incident_type || ''] || '#6B7280'
  const nation     = r.data?.nationality_type || '不明'
  const nationClr  = getNationalityColor(nation)
  const dateLbl    = formatDate(r.occurred_at)
  const createdLbl = !dateLbl ? formatDate(r.created_at?.slice(0, 10) ?? null) : null
  const isOwn      = !!currentUserId && r.submitted_by === currentUserId

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await adminDeleteReport(adminToken!, r.id)
    if (ok) {
      onAdminDelete?.(r.id)
      onClose?.()
    } else {
      alert('削除に失敗しました')
    }
  }

  function handleAction(e: React.MouseEvent) {
    e.stopPropagation()
    // 管理者 or 自分の投稿 → 直接編集、それ以外 → 訂正申請
    if (isAdmin || isOwn) {
      window.location.href = `/my-reports?edit=${r.id}`
    } else {
      window.location.href = `/submit?correct=${r.id}`
    }
  }

  function handleComment(e: React.MouseEvent) {
    e.stopPropagation()
    if (onOpenThread) {
      onOpenThread(r)
      onClose?.()
    }
  }

  return (
    <div style={{
      width,
      background: '#111827',
      border: '1px solid #1e2d40',
      borderRadius: 6,
      padding: '10px 12px',
      boxSizing: 'border-box',
      position: 'relative',
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      {/* 記事ID */}
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>#{r.id}</div>

      {/* 種別バッジ */}
      <div style={{
        display: 'inline-block', padding: '2px 7px',
        background: `${color}33`, color,
        border: `1px solid ${color}66`,
        borderRadius: 4, fontSize: 10, marginBottom: 4,
      }}>{r.data?.incident_type || 'その他'}</div>

      {/* 日付 */}
      {dateLbl && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>📅 発生日 {dateLbl}</div>
      )}
      {!dateLbl && createdLbl && (
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>投稿日 {createdLbl}</div>
      )}

      {/* タイトル */}
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, lineHeight: 1.4, color: '#e2e8f0' }}>
        {r.title || '（タイトルなし）'}
      </div>

      {/* 住所 */}
      {r.address && (
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>📍 {r.address}</div>
      )}

      {/* 国籍 */}
      <div style={{ fontSize: 10, marginBottom: 6 }}>
        <span style={{
          padding: '1px 5px',
          background: nationClr.bg,
          color: nationClr.text,
          borderRadius: 4,
        }}>{nation}</span>
      </div>

      {/* ソースリンク */}
      {r.source_url && (
        <a
          href={r.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-block', marginBottom: 6, fontSize: 10,
            color: '#60a5fa', textDecoration: 'none',
          }}
        >🔗 ソースを確認</a>
      )}

      {/* アクションボタン行 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {/* 編集（管理者 or 自分の投稿） / 訂正申請（ログイン済みの他者投稿） */}
        {(isAdmin || isLoggedIn) && (
          <button
            onClick={handleAction}
            style={{
              padding: '3px 10px',
              background: 'transparent',
              color: (isAdmin || isOwn) ? '#60a5fa' : '#fbbf24',
              border: `1px solid ${(isAdmin || isOwn) ? '#60a5fa55' : '#fbbf2455'}`,
              borderRadius: 4, fontSize: 11, cursor: 'pointer',
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >{(isAdmin || isOwn) ? '✏️ 編集' : '📝 訂正申請'}</button>
        )}

        {/* コメント（常に表示 ─ 未ログインはパネル内でログインボタンを表示） */}
        {onOpenThread && (
          <button
            onClick={handleComment}
            style={{
              padding: '3px 10px',
              background: 'transparent', color: '#94a3b8',
              border: '1px solid #1e2d4088',
              borderRadius: 4, fontSize: 11, cursor: 'pointer',
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >💬 コメント</button>
        )}

        {/* 管理者専用削除ボタン（右下 ─ ポップアップの×と被らない位置） */}
        {isAdmin && adminToken && (
          <button
            onClick={handleDelete}
            style={{
              padding: '3px 10px',
              background: '#ef444411', border: '1px solid #ef444455',
              borderRadius: 4, color: '#ef4444',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >🗑️ 削除</button>
        )}
      </div>
    </div>
  )
}
