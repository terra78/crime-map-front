'use client'

import { useEffect, useRef } from 'react'
import { Report, PrefectureStat } from '../lib/api'

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
  onBoundsChange?: (bounds: {
    min_lat: number; max_lat: number
    min_lng: number; max_lng: number
  }) => void
}

// occurred_at を "YYYY年M月D日" 形式にフォーマット
function formatDate(s: string | null): string | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`
}

export default function Map({ reports, prefectureStats = [], layerMode = 'pins', searchTarget, onBoundsChange }: Props) {
  const mapRef        = useRef<HTMLDivElement>(null)
  const mapObjRef     = useRef<any>(null)
  const markersRef    = useRef<any[]>([])
  const bubblesRef    = useRef<any[]>([])
  const tempMarkersRef = useRef<any[]>([])   // 他○件ポップアップ用一時マーカー

  useEffect(() => {
    if (typeof window === 'undefined' || mapObjRef.current) return

    const L = require('leaflet')

    // 日本全体が見えるズームレベル
    const map = L.map(mapRef.current!, {
      center: [36.5, 137.0],
      zoom: 5,
      zoomControl: false,
    })

    // 日本語ラベル対応タイル（国土地理院）
    L.tileLayer(
      'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
      { attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>', maxZoom: 18 }
    ).addTo(map)

    // カスタムズームコントロール（右下）
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // 境界変更時にコールバック
    map.on('moveend', () => {
      const b = map.getBounds()
      onBoundsChange?.({
        min_lat: b.getSouth(), max_lat: b.getNorth(),
        min_lng: b.getWest(),  max_lng: b.getEast(),
      })
    })

    mapObjRef.current = map
    return () => { map.remove(); mapObjRef.current = null }
  }, [])

  // 外部からの地図移動（検索）
  useEffect(() => {
    if (!mapObjRef.current || !searchTarget) return
    mapObjRef.current.setView([searchTarget.lat, searchTarget.lng], searchTarget.zoom ?? 13)
  }, [searchTarget])

  // ピンマーカー更新
  useEffect(() => {
    if (!mapObjRef.current) return
    const L   = require('leaflet')
    const map = mapObjRef.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    tempMarkersRef.current.forEach(m => m.remove())
    tempMarkersRef.current = []

    if (layerMode !== 'pins') return

    // ── 同一座標グループ化（小数点4桁 ≈ 約11m 精度でキー） ──────────────────
    // ※ コンポーネント名が "Map" のため globalThis.Map で組み込みクラスを参照
    const grouped = new globalThis.Map<string, Report[]>()
    reports.forEach(r => {
      const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(r)
    })

    // ── 他○件ポップアップを円形配置で表示 ────────────────────────────────────
    const showOthers = (primary: Report, others: Report[]) => {
      // 既存の他件マーカーをすべて削除（トグル的な動作）
      if (tempMarkersRef.current.length > 0) {
        tempMarkersRef.current.forEach(m => m.remove())
        tempMarkersRef.current = []
        return
      }

      const centerPt = map.latLngToContainerPoint([primary.lat, primary.lng])
      const radius   = 220  // ピクセル半径

      others.forEach((r, i) => {
        // 上から時計回りに均等配置
        const angle   = (i / others.length) * 2 * Math.PI - Math.PI / 2
        const px      = centerPt.x + radius * Math.cos(angle)
        const py      = centerPt.y + radius * Math.sin(angle)
        const latlng  = map.containerPointToLatLng(L.point(px, py))

        const color   = INCIDENT_COLORS[r.data?.incident_type || ''] || '#6B7280'
        const nation  = r.data?.nationality_type || '不明'
        const dateLbl = formatDate(r.occurred_at)
        const linkId2 = `other-link-${r.id}`

        const tooltipHtml = `
          <div>
            <div style="display:inline-block;padding:2px 6px;background:${color}33;color:${color};border:1px solid ${color}66;border-radius:4px;font-size:10px;margin-bottom:6px;">
              ${r.data?.incident_type || 'その他'}
            </div>
            <div style="font-size:12px;font-weight:600;margin-bottom:3px;line-height:1.4;">
              ${r.title || '（タイトルなし）'}
            </div>
            ${r.address ? `<div style="font-size:10px;color:#64748b;margin-bottom:2px;">📍 ${r.address}</div>` : ''}
            ${dateLbl   ? `<div style="font-size:10px;color:#64748b;margin-bottom:4px;">📅 ${dateLbl}</div>` : ''}
            <div style="font-size:10px;">
              <span style="padding:1px 5px;background:${nation === '外国人' ? '#FF704333' : '#4FC3F733'};color:${nation === '外国人' ? '#FF7043' : '#4FC3F7'};border-radius:4px;">
                ${nation}
              </span>
            </div>
            ${r.source_url ? `<a id="${linkId2}" href="${r.source_url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:10px;color:#60a5fa;text-decoration:none;">🔗 ソースを確認</a>` : ''}
          </div>
        `

        // 小さなドットマーカーを配置してツールチップをアンカーにする
        const tempMarker = L.circleMarker(latlng, {
          radius:      5,
          color:       color,
          fillColor:   color,
          fillOpacity: 0.9,
          weight:      2,
          opacity:     0.9,
        })

        tempMarker.bindTooltip(tooltipHtml, {
          permanent:   true,
          interactive: true,
          className:   'crime-popup-other',
          direction:   'top',
          offset:      [0, -6],
        })

        tempMarker.addTo(map)
        tempMarker.openTooltip()
        tempMarkersRef.current.push(tempMarker)
      })
    }

    // ── グループごとにマーカーを生成 ─────────────────────────────────────────
    grouped.forEach(group => {
      const primary = group[0]
      const others  = group.slice(1, 21)   // 最大20件

      const color  = INCIDENT_COLORS[primary.data?.incident_type || ''] || '#6B7280'
      const nation = primary.data?.nationality_type || '不明'

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
              font-size: 11px;
              line-height: 24px;
            ">${nation === '外国人' ? '外' : nation === '日本人' ? '日' : '?'}</div>
          </div>`,
        iconSize:   [28, 28],
        iconAnchor: [14, 28],
      })

      const dateLabel  = formatDate(primary.occurred_at)
      const linkId     = `src-link-${primary.id}`

      const sourceHtml = primary.source_url ? `
        <a id="${linkId}" href="${primary.source_url}" target="_blank" rel="noopener" style="
          display: inline-block; margin-top: 8px; font-size: 11px;
          color: #60a5fa; text-decoration: none;
        ">🔗 ソースを確認</a>` : ''

      const othersHtml = others.length > 0 ? `
        <div style="
          text-align: right; margin-top: 8px;
          border-top: 1px solid #1e2d40; padding-top: 6px;
        ">
          <a id="others-btn-${primary.id}" href="#" style="
            font-size: 11px; color: #94a3b8; text-decoration: none;
          ">他${others.length}件 →</a>
        </div>` : ''

      const popup = L.popup({
        className: 'crime-popup',
        maxWidth: 280,
      }).setContent(`
        <div style="
          background: #111827; color: #e2e8f0;
          padding: 12px; border-radius: 8px;
          font-family: 'Noto Sans JP', sans-serif;
          min-width: 200px;
        ">
          <div style="
            display: inline-block; padding: 2px 8px;
            background: ${color}33; color: ${color};
            border: 1px solid ${color}66;
            border-radius: 4px; font-size: 11px; margin-bottom: 8px;
          ">${primary.data?.incident_type || 'その他'}</div>
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            ${primary.title || '（タイトルなし）'}
          </div>
          ${primary.address ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📍 ${primary.address}</div>` : ''}
          ${dateLabel       ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📅 ${dateLabel}</div>` : ''}
          <div style="font-size: 11px; margin-top: 6px;">
            <span style="
              padding: 1px 6px;
              background: ${nation === '外国人' ? '#FF704333' : '#4FC3F733'};
              color: ${nation === '外国人' ? '#FF7043' : '#4FC3F7'};
              border-radius: 4px;
            ">${nation}</span>
          </div>
          ${sourceHtml}
          ${othersHtml}
        </div>
      `)

      const marker = L.marker([primary.lat, primary.lng], { icon }).bindPopup(popup)

      // ポップアップが開いたとき
      marker.on('popupopen', async () => {
        // ── ソースURL生存確認 ──────────────────────────────────────────────
        if (primary.source_url) {
          const linkEl = document.getElementById(linkId) as HTMLAnchorElement | null
          if (linkEl) {
            try {
              await fetch(primary.source_url, {
                method: 'HEAD',
                mode:   'no-cors',
                signal: AbortSignal.timeout(5000),
              })
            } catch {
              if (primary.archive_url) {
                linkEl.href        = primary.archive_url
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

        // ── 他○件リンクにクリックハンドラを付与 ──────────────────────────
        if (others.length > 0) {
          const othersBtn = document.getElementById(`others-btn-${primary.id}`)
          if (othersBtn) {
            // addEventListener は毎回新しい関数なので once:true で管理
            othersBtn.addEventListener('click', (e) => {
              e.preventDefault()
              showOthers(primary, others)
            }, { once: true })
          }
        }
      })

      // ポップアップが閉じたとき → 他件マーカーをすべて削除
      marker.on('popupclose', () => {
        tempMarkersRef.current.forEach(m => m.remove())
        tempMarkersRef.current = []
      })

      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [reports, layerMode])

  // バブルレイヤー更新
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
      // 件数が多いほど赤、少ないほどオレンジ
      const r = Math.round(255)
      const g = Math.round(160 * (1 - ratio))
      const b = Math.round(20 * (1 - ratio))
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

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
