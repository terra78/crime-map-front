'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SignInButton } from '@clerk/nextjs'
import { Report, Comment, fetchComments, postComment } from '../lib/api'
import { formatDate } from './Map'

// ── 相対日時フォーマット ──────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec  = Math.floor(diff / 1000)
  const min  = Math.floor(sec  / 60)
  const hr   = Math.floor(min  / 60)
  const day  = Math.floor(hr   / 24)
  const mon  = Math.floor(day  / 30)
  const yr   = Math.floor(mon  / 12)

  if (yr  >= 1) return `${yr}年前`
  if (mon >= 1) return `${mon}ヶ月前`
  if (day >= 1) return `${day}日前`
  if (hr  >= 1) return `${hr}時間前`
  if (min >= 1) return `${min}分前`
  return 'たった今'
}

// ── ユーザーアバター ──────────────────────────────────────────────────────────
function Avatar({ name, avatar, size = 32 }: { name: string | null; avatar: string | null; size?: number }) {
  const initial = (name || '?')[0].toUpperCase()
  // 名前から色を決定（ハッシュ）
  const colors = ['#FF7043','#4FC3F7','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899']
  const idx    = (name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length
  const color  = colors[idx]

  if (avatar) {
    return (
      <img
        src={avatar} alt={name || ''}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700, flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

// ── 単一コメントカード ────────────────────────────────────────────────────────
function CommentCard({
  comment,
  depth,
  onReply,
  replyingTo,
  onCancelReply,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  submitting,
  isLoggedIn,
}: {
  comment: Comment
  depth: number
  onReply: (id: number) => void
  replyingTo: number | null
  onCancelReply: () => void
  replyText: string
  onReplyTextChange: (t: string) => void
  onSubmitReply: () => void
  submitting: boolean
  isLoggedIn: boolean
}) {
  return (
    <div style={{ marginLeft: depth > 0 ? 32 : 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
        <Avatar name={comment.user_name} avatar={comment.user_avatar} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
              {comment.user_name || '匿名'}
            </span>
            <span style={{ fontSize: 10, color: '#475569' }}>
              {relativeTime(comment.created_at)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {comment.content}
          </div>
          {/* 返信ボタン */}
          {isLoggedIn && (
            <button
              onClick={() => onReply(comment.id)}
              style={{
                marginTop: 4, background: 'none', border: 'none',
                color: '#475569', fontSize: 11, cursor: 'pointer', padding: 0,
              }}
            >
              ↩ 返信
            </button>
          )}
        </div>
      </div>

      {/* 返信フォーム */}
      {replyingTo === comment.id && (
        <div style={{ marginLeft: 40, marginBottom: 8 }}>
          <textarea
            value={replyText}
            onChange={e => onReplyTextChange(e.target.value)}
            placeholder="返信を入力..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f172a', border: '1px solid #1e2d40',
              borderRadius: 6, color: '#e2e8f0', fontSize: 12,
              padding: '8px', resize: 'vertical', outline: 'none',
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={onCancelReply}
              style={{
                background: 'none', border: 'none', color: '#475569',
                fontSize: 11, cursor: 'pointer', padding: 0,
              }}
            >
              キャンセル
            </button>
            <button
              onClick={onSubmitReply}
              disabled={submitting || !replyText.trim()}
              style={{
                padding: '4px 12px',
                background: submitting || !replyText.trim() ? '#1e2d40' : '#4FC3F7',
                color: submitting || !replyText.trim() ? '#475569' : '#0a0f1a',
                border: 'none', borderRadius: 4, fontSize: 11,
                fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              コメント
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ThreadPanel メイン ────────────────────────────────────────────────────────
type Props = {
  report: Report
  onClose: () => void
  currentUserId: string | null
  currentUserName?: string | null
  currentUserAvatar?: string | null
  getToken: () => Promise<string | null>
}

export default function ThreadPanel({
  report, onClose, currentUserId, currentUserName, currentUserAvatar, getToken,
}: Props) {
  const [comments, setComments]     = useState<Comment[]>([])
  const [loading, setLoading]       = useState(true)
  const [sort, setSort]             = useState<'asc' | 'desc'>('asc')
  const [newText, setNewText]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText]   = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const isLoggedIn = !!currentUserId

  const reload = useCallback(async () => {
    setLoading(true)
    const data = await fetchComments(report.id)
    setComments(data)
    setLoading(false)
  }, [report.id])

  useEffect(() => { reload() }, [reload])

  const topLevel = comments.filter(c => !c.parent_id)
  const sorted = sort === 'asc' ? topLevel : [...topLevel].reverse()

  async function handleSubmit() {
    if (!newText.trim()) return
    setSubmitting(true)
    const token = await getToken()
    if (!token) { setSubmitting(false); return }
    await postComment(report.id, token, {
      content: newText.trim(),
      user_name: currentUserName ?? undefined,
      user_avatar: currentUserAvatar ?? undefined,
    })
    setNewText('')
    await reload()
    setSubmitting(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleReplySubmit() {
    if (!replyText.trim() || replyingTo === null) return
    setSubmitting(true)
    const token = await getToken()
    if (!token) { setSubmitting(false); return }
    await postComment(report.id, token, {
      content: replyText.trim(),
      user_name: currentUserName ?? undefined,
      user_avatar: currentUserAvatar ?? undefined,
      parent_id: replyingTo,
    })
    setReplyText('')
    setReplyingTo(null)
    await reload()
    setSubmitting(false)
  }

  const dateLabel    = formatDate(report.occurred_at)
  const createdLabel = formatDate(report.created_at?.slice(0, 10) ?? null)
  const shareText    = encodeURIComponent(`${report.title || '事件'}\n${report.address || ''}`)
  const shareUrl     = encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/`)
  const twitterUrl   = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 340, minWidth: 300, maxWidth: '100%',
      background: '#0a0f1a',
      borderLeft: '1px solid #1e2d40',
      display: 'flex', flexDirection: 'column',
      zIndex: 1100,
      fontFamily: "'Noto Sans JP', sans-serif",
      boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
    }}>
      {/* ── ヘッダー ── */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #1e2d40',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>#{report.id}</div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#e2e8f0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {report.title || '（タイトルなし）'}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #1e2d40', borderRadius: 4,
          color: '#64748b', fontSize: 14, cursor: 'pointer',
          padding: '2px 8px', flexShrink: 0,
        }}>✕</button>
      </div>

      {/* ── スクロール領域 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

        {/* 記事詳細 */}
        <div style={{
          background: '#111827', border: '1px solid #1e2d40',
          borderRadius: 8, padding: '12px', marginBottom: 12,
        }}>
          {report.data?.incident_type && (
            <div style={{
              display: 'inline-block', padding: '2px 8px', marginBottom: 8,
              background: '#FF704333', color: '#FF7043',
              border: '1px solid #FF704366', borderRadius: 4, fontSize: 11,
            }}>
              {report.data.incident_type}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: '#94a3b8' }}>
            {dateLabel && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#475569', width: 60, flexShrink: 0 }}>発生日</span>
                <span style={{ color: '#e2e8f0' }}>{dateLabel}</span>
              </div>
            )}
            {report.address && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#475569', width: 60, flexShrink: 0 }}>住所</span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{report.address}</span>
              </div>
            )}
            {report.data?.nationality_type && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#475569', width: 60, flexShrink: 0 }}>国籍</span>
                <span style={{ color: '#e2e8f0' }}>{report.data.nationality_type}</span>
              </div>
            )}
            {createdLabel && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#475569', width: 60, flexShrink: 0 }}>投稿日</span>
                <span style={{ color: '#475569' }}>{createdLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* シェアボタン + ログインボタン */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <a
            href={twitterUrl}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 12px',
              background: '#111827', border: '1px solid #1e2d40',
              borderRadius: 6, color: '#e2e8f0', fontSize: 11,
              textDecoration: 'none', fontWeight: 600,
            }}
          >
            𝕏 シェア
          </a>
          {!isLoggedIn && (
            <SignInButton mode="modal">
              <button style={{
                padding: '6px 12px',
                background: '#111827', color: '#fff',
                border: '1px solid #374151', borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                ログイン
              </button>
            </SignInButton>
          )}
        </div>

        {/* コメント投稿フォーム（ログイン済みのみ） */}
        {isLoggedIn && (
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="コメントを入力..."
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#111827', border: '1px solid #1e2d40',
                borderRadius: 6, color: '#e2e8f0', fontSize: 12,
                padding: '10px', resize: 'vertical', outline: 'none',
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none',
                  color: '#475569', fontSize: 12, cursor: 'pointer', padding: 0,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !newText.trim()}
                style={{
                  padding: '6px 16px',
                  background: submitting || !newText.trim() ? '#1e2d40' : '#4FC3F7',
                  color: submitting || !newText.trim() ? '#475569' : '#0a0f1a',
                  border: 'none', borderRadius: 6, fontSize: 12,
                  fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? '送信中…' : 'コメント'}
              </button>
            </div>
          </div>
        )}

        {/* コメント一覧 */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, paddingTop: 8 }}>
            読み込み中…
          </div>
        ) : comments.length > 0 ? (
          <div>
            {/* ヘッダー + ソート */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #1e2d40',
            }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                {comments.length}件のコメント
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['asc', 'desc'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    style={{
                      background: 'none', border: 'none',
                      color: sort === s ? '#4FC3F7' : '#475569',
                      fontSize: 10, cursor: 'pointer', padding: 0,
                      fontWeight: sort === s ? 700 : 400,
                    }}
                  >
                    {s === 'asc' ? '古い順' : '新しい順'}
                  </button>
                ))}
              </div>
            </div>

            {/* コメントリスト */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sorted.map(c => {
                const replies = comments.filter(r => r.parent_id === c.id)
                return (
                  <div key={c.id}>
                    <CommentCard
                      comment={c}
                      depth={0}
                      onReply={id => { setReplyingTo(id); setReplyText('') }}
                      replyingTo={replyingTo}
                      onCancelReply={() => setReplyingTo(null)}
                      replyText={replyText}
                      onReplyTextChange={setReplyText}
                      onSubmitReply={handleReplySubmit}
                      submitting={submitting}
                      isLoggedIn={isLoggedIn}
                    />
                    {/* 返信コメント */}
                    {replies.map(reply => (
                      <div key={reply.id} style={{ marginTop: 8 }}>
                        <CommentCard
                          comment={reply}
                          depth={1}
                          onReply={id => { setReplyingTo(id); setReplyText('') }}
                          replyingTo={replyingTo}
                          onCancelReply={() => setReplyingTo(null)}
                          replyText={replyText}
                          onReplyTextChange={setReplyText}
                          onSubmitReply={handleReplySubmit}
                          submitting={submitting}
                          isLoggedIn={isLoggedIn}
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          !isLoggedIn && (
            <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, paddingTop: 8 }}>
              コメントはまだありません
            </div>
          )
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
