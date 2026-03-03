'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Report, PrefectureStat, adminDeleteReport } from '../lib/api'
import ReportCard from './ReportCard'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故': '#F59E0B',
  '窃盗':    '#EF4444',
  '暴行':    '#DC2626',
  '詐欺':    '#8B5CF6',
  'その他':  '#6B7280',
}

type Props = {
  reports: Report[]
  prefectureStats?: PrefectureStat[]
  layerMode?: 'pins' | 'bubbles'
  searchTarget?: { lat: number; lng: number; zoom?: number } | null
  currentUserId?: string | null
  isAdmin?: boolean
  adminToken?: string | null
  onAdminDelete?: (id: number) => void
  onOpenThread?: (report: Report) => void
  onBoundsChange?: (bounds: {
    min_lat: number; max_lat: number
    min_lng: number; max_lng: number
  }) => void
}

export function formatDate(s: string | null): string | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`
}

function sortByDate(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    const da = a.occurred_at || ''
    const db = b.occurred_at || ''
    return db.localeCompare(da)
  })
}

// ── 同一地点グループパネル（2〜20件） ───────────────────────────────────────
function GroupPanel({
  reports, onClose, onSelect, currentUserId, isLoggedIn, isAdmin, adminToken, onAdminDelete,
}: {
  reports: Report[]
  onClose: () => void
  onSelect?: (r: Report) => void
  currentUserId?: string | null
  isLoggedIn?: boolean
  isAdmin?: boolean
  adminToken?: string | null
  onAdminDelete?: (id: number) => void
}) {
  return (
    <div style={{
      position: 'absolute', top: 8, left: 8, zIndex: 500,
      background: '#0a0f1a', border: '1px solid #1e2d40',
      borderRadius: 10, padding: 12,
      maxWidth: 580, maxHeight: 'calc(100% - 80px)',
      overflowY: 'auto',
      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
          同一地点の事件&nbsp;<span style={{ color: '#FF7043' }}>{reports.length}件</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #1e2d40', borderRadius: 4,
            color: '#64748b', fontSize: 13, cursor: 'pointer',
            padding: '2px 8px', lineHeight: 1.4,
          }}
        >✕</button>
      </div>

      {/* カードグリッド（共通 ReportCard を使用） */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {reports.map(r => (
          <ReportCard
            key={r.id}
            report={r}
            currentUserId={currentUserId}
            isLoggedIn={isLoggedIn}
            isAdmin={isAdmin}
            adminToken={adminToken}
            onAdminDelete={onAdminDelete}
            onOpenThread={onSelect}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  )
}

export default function Map({ reports, prefectureStats = [], layerMode = 'pins', searchTarget, currentUserId, isAdmin, adminToken, onAdminDelete, onOpenThread, onBoundsChange }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const mapObjRef  = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const bubblesRef = useRef<any[]>([])
  const [groupPanel, setGroupPanel] = useState<Report[] | null>(null)

  // onOpenThread / onAdminDelete を ref で保持（stale closure 回避）
  const onOpenThreadRef  = useRef(onOpenThread)
  const onAdminDeleteRef = useRef(onAdminDelete)
  useEffect(() => { onOpenThreadRef.current = onOpenThread }, [onOpenThread])
  useEffect(() => { onAdminDeleteRef.current = onAdminDelete }, [onAdminDelete])

  // ── 地図初期化 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || mapObjRef.current) return

    const L = require('leaflet')

    const map = L.map(mapRef.current!, {
      center: [36.5, 137.0],
      zoom: 5,
      zoomControl: false,
    })

    L.tileLayer(
      'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
      { attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>', maxZoom: 18 }
    ).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    map.on('moveend', () => {
      const b = map.getBounds()
      onBoundsChange?.({
        min_lat: b.getSouth(), max_lat: b.getNorth(),
        min_lng: b.getWest(),  max_lng: b.getEast(),
      })
    })

    // 地図クリックでグループパネルを閉じる
    map.on('click', () => setGroupPanel(null))

    mapObjRef.current = map
    return () => { map.remove(); mapObjRef.current = null }
  }, [])

  // ── 地図移動（検索） ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapObjRef.current || !searchTarget) return
    mapObjRef.current.setView([searchTarget.lat, searchTarget.lng], searchTarget.zoom ?? 13)
  }, [searchTarget])

  // ── ピンマーカー更新 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapObjRef.current) return
    const L = require('leaflet')

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    setGroupPanel(null)

    if (layerMode !== 'pins') return

    // 同一座標グループ化（小数点4桁 ≈ 約11m精度）
    // ※ コンポーネント名が "Map" のため globalThis.Map で組み込みクラスを参照
    const grouped = new globalThis.Map<string, Report[]>()
    reports.forEach(r => {
      const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(r)
    })

    grouped.forEach(group => {
      // 発生日時の降順でソート
      const sorted  = sortByDate(group)
      const primary = sorted[0]
      const count   = sorted.length

      const color  = INCIDENT_COLORS[primary.data?.incident_type || ''] || '#6B7280'
      const nation = primary.data?.nationality_type || '不明'

      // ピン内テキスト：件数を表示（常に数字）
      const innerText     = String(count)
      const innerFontSize = count >= 10 ? '9px' : '11px'
      const innerWeight   = count >= 2 ? '700' : '400'

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 28px; height: 28px;
            background: ${color};
            border: 2px solid rgba(255,255,255,0.8);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            cursor: pointer;
          ">
            <div style="
              transform: rotate(45deg);
              text-align: center;
              font-size: ${innerFontSize};
              line-height: 24px;
              font-weight: ${innerWeight};
            ">${innerText}</div>
          </div>`,
        iconSize:   [28, 28],
        iconAnchor: [14, 28],
      })

      // ──────────────────────────────────────────────────────────────────────
      // 1件: 通常のポップアップ
      // ──────────────────────────────────────────────────────────────────────
      if (count === 1) {
        const dateLabel    = formatDate(primary.occurred_at)
        const createdLabel = !dateLabel ? formatDate(primary.created_at?.slice(0, 10) ?? null) : null
        const linkId      = `src-link-${primary.id}`
        const actionBtnId = `action-btn-${primary.id}`
        const threadBtnId = `thread-btn-${primary.id}`
        const adminDelId  = `admin-del-${primary.id}`

        const sourceHtml = primary.source_url ? `
          <a id="${linkId}" href="${primary.source_url}" target="_blank" rel="noopener" style="
            display: inline-block; margin-top: 8px; font-size: 11px;
            color: #60a5fa; text-decoration: none;
          ">🔗 ソースを確認</a>` : ''

        // 自分の投稿なら「編集」、他人なら「訂正申請」ボタン（未ログインは非表示）
        const isOwn = !!currentUserId && primary.submitted_by === currentUserId
        const actionBtnLabel = isOwn ? '✏️ 編集' : '📝 訂正申請'
        const actionBtnColor = isOwn ? '#60a5fa' : '#fbbf24'
        const actionBtnHtml = currentUserId ? `
          <button id="${actionBtnId}" style="
            display: inline-block; margin-top: 8px; padding: 3px 10px;
            background: transparent;
            color: ${actionBtnColor};
            border: 1px solid ${actionBtnColor}55;
            border-radius: 4px; font-size: 11px; cursor: pointer;
            font-family: 'Noto Sans JP', sans-serif;
          ">${actionBtnLabel}</button>` : ''

        // スレッドボタン
        const threadBtnHtml = `
          <button id="${threadBtnId}" style="
            display: inline-block; margin-top: 8px; margin-left: 6px; padding: 3px 10px;
            background: transparent; color: #94a3b8;
            border: 1px solid #1e2d4088;
            border-radius: 4px; font-size: 11px; cursor: pointer;
            font-family: 'Noto Sans JP', sans-serif;
          ">💬 コメント</button>`

        // 管理者専用削除ボタン（ポップアップ右上）
        const adminDelHtml = isAdmin ? `
          <button id="${adminDelId}" title="物理削除（管理者）" style="
            position: absolute; top: 4px; right: 4px;
            background: #ef444422; border: 1px solid #ef444466;
            border-radius: 4px; color: #ef4444;
            font-size: 12px; font-weight: 700; cursor: pointer;
            padding: 1px 6px; line-height: 1.4;
            font-family: 'Noto Sans JP', sans-serif;
          ">✕</button>` : ''

        const popup = L.popup({
          className: 'crime-popup',
          maxWidth: 280,
        }).setContent(`
          <div style="
            background: #111827; color: #e2e8f0;
            padding: 12px; border-radius: 8px;
            font-family: 'Noto Sans JP', sans-serif;
            min-width: 200px; position: relative;
          ">
            ${adminDelHtml}
            <div style="font-size: 10px; color: #475569; margin-bottom: 4px;">#${primary.id}</div>
            <div style="
              display: inline-block; padding: 2px 8px;
              background: ${color}33; color: ${color};
              border: 1px solid ${color}66;
              border-radius: 4px; font-size: 11px; margin-bottom: 2px;
            ">${primary.data?.incident_type || 'その他'}</div>
            ${dateLabel
              ? `<div style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;">📅 発生日 ${dateLabel}</div>`
              : createdLabel
                ? `<div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">投稿日 ${createdLabel}</div>`
                : ''
            }
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
              ${primary.title || '（タイトルなし）'}
            </div>
            ${primary.address ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📍 ${primary.address}</div>` : ''}
            <div style="font-size: 11px; margin-top: 6px;">
              <span style="
                padding: 1px 6px;
                background: ${nation === '外国人' ? '#FF704333' : '#4FC3F733'};
                color: ${nation === '外国人' ? '#FF7043' : '#4FC3F7'};
                border-radius: 4px;
              ">${nation}</span>
            </div>
            ${sourceHtml}
            <div style="display:flex; flex-wrap:wrap; gap:0;">
              ${actionBtnHtml}${threadBtnHtml}
            </div>
          </div>
        `)

        const marker = L.marker([primary.lat, primary.lng], { icon }).bindPopup(popup)

        // popupopen: リンク切れ検出 ＋ 各ボタンのクリックハンドラ登録
        marker.on('popupopen', async () => {
          // リンク切れ検出
          if (primary.source_url) {
            const sourceUrl  = primary.source_url
            const archiveUrl = primary.archive_url
            const linkEl = document.getElementById(linkId) as HTMLAnchorElement | null
            if (linkEl) {
              try {
                await fetch(sourceUrl, {
                  method: 'HEAD',
                  mode:   'no-cors',
                  signal: AbortSignal.timeout(5000),
                })
              } catch {
                if (archiveUrl) {
                  linkEl.href        = archiveUrl
                  linkEl.textContent = '📦 魚拓を確認（元リンク切れ）'
                  linkEl.style.color = '#fb923c'
                } else {
                  linkEl.textContent = '⚠️ リンク切れ'
                  linkEl.style.color = '#ef4444'
                  linkEl.removeAttribute('href')
                  linkEl.style.cursor = 'default'
                }
              }
            }
          }

          // アクションボタン（編集 / 訂正申請）
          const actionBtn = document.getElementById(actionBtnId) as HTMLButtonElement | null
          if (actionBtn) {
            actionBtn.onclick = () => {
              if (isOwn) {
                window.location.href = `/my-reports?edit=${primary.id}`
              } else {
                window.location.href = `/submit?correct=${primary.id}`
              }
            }
          }

          // コメントスレッドボタン
          const threadBtn = document.getElementById(threadBtnId) as HTMLButtonElement | null
          if (threadBtn) {
            threadBtn.onclick = () => {
              marker.closePopup()
              onOpenThreadRef.current?.(primary)
            }
          }

          // 管理者削除ボタン（確認ダイアログなし）
          if (isAdmin && adminToken) {
            const delBtn = document.getElementById(adminDelId) as HTMLButtonElement | null
            if (delBtn) {
              delBtn.onclick = async () => {
                const ok = await adminDeleteReport(adminToken, primary.id)
                if (ok) {
                  marker.closePopup()
                  marker.remove()
                  onAdminDeleteRef.current?.(primary.id)
                } else {
                  alert('削除に失敗しました')
                }
              }
            }
          }
        })

        marker.addTo(mapObjRef.current)
        markersRef.current.push(marker)

      // ──────────────────────────────────────────────────────────────────────
      // 2〜20件: クリックで左上にカードグリッドを表示
      // ──────────────────────────────────────────────────────────────────────
      } else if (count <= 20) {
        const marker = L.marker([primary.lat, primary.lng], {
          icon,
          bubblingMouseEvents: false,   // 地図のクリックに伝播させない
        })
        marker.on('click', () => setGroupPanel(sorted))
        marker.addTo(mapObjRef.current)
        markersRef.current.push(marker)

      // ──────────────────────────────────────────────────────────────────────
      // 21件以上: 別タブで一覧ページを開く（最大100件）
      // ──────────────────────────────────────────────────────────────────────
      } else {
        const marker = L.marker([primary.lat, primary.lng], {
          icon,
          bubblingMouseEvents: false,
        })
        marker.on('click', () => {
          try {
            localStorage.setItem('crime-map-group', JSON.stringify({
              reports: sorted.slice(0, 100),
              address: primary.address || '',
              lat: primary.lat,
              lng: primary.lng,
            }))
          } catch {}
          window.open('/location', '_blank')
        })
        marker.addTo(mapObjRef.current)
        markersRef.current.push(marker)
      }
    })
  }, [reports, layerMode, isAdmin, adminToken])

  // ── バブルレイヤー更新 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapObjRef.current) return
    const L = require('leaflet')

    bubblesRef.current.forEach(c => c.remove())
    bubblesRef.current = []

    if (layerMode !== 'bubbles' || prefectureStats.length === 0) return

    const maxCount = Math.max(...prefectureStats.map(s => s.count_recognized), 1)

    prefectureStats.forEach(s => {
      const ratio  = s.count_recognized / maxCount
      const radius = Math.max(10, Math.log(s.count_recognized + 1) * 7)
      const r = Math.round(255)
      const g = Math.round(160 * (1 - ratio))
      const b = Math.round(20  * (1 - ratio))
      const color = `rgb(${r},${g},${b})`

      const circle = L.circleMarker([s.lat, s.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.55,
        weight: 1.5,
      })

      circle.bindPopup(`
        <div style="
          background: #111827; color: #e2e8f0;
          padding: 12px; border-radius: 8px;
          font-family: 'Noto Sans JP', sans-serif;
          min-width: 180px;
        ">
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">
            ${s.prefecture_name}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
            ${s.year}年 / ${s.crime_category}
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">認知件数</span>
              <span style="color: #FF7043; font-weight: 600; font-family: monospace;">
                ${s.count_recognized.toLocaleString()}
              </span>
            </div>
            ${s.count_cleared != null ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">検挙件数</span>
              <span style="color: #e2e8f0; font-family: monospace;">
                ${s.count_cleared.toLocaleString()}
              </span>
            </div>` : ''}
            ${s.count_arrested != null ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">検挙人員</span>
              <span style="color: #e2e8f0; font-family: monospace;">
                ${s.count_arrested.toLocaleString()}
              </span>
            </div>` : ''}
          </div>
        </div>
      `)

      circle.addTo(mapObjRef.current)
      bubblesRef.current.push(circle)
    })
  }, [prefectureStats, layerMode])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {groupPanel && (
        <GroupPanel
          reports={groupPanel}
          onClose={() => setGroupPanel(null)}
          onSelect={r => { setGroupPanel(null); onOpenThreadRef.current?.(r) }}
          currentUserId={currentUserId}
          isLoggedIn={!!currentUserId}
          isAdmin={isAdmin}
          adminToken={adminToken}
          onAdminDelete={id => { setGroupPanel(null); onAdminDeleteRef.current?.(id) }}
        />
      )}
    </div>
  )
}
