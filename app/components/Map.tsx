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
  onBoundsChange?: (bounds: {
    min_lat: number; max_lat: number
    min_lng: number; max_lng: number
  }) => void
}

export default function Map({ reports, prefectureStats = [], layerMode = 'pins', onBoundsChange }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const bubblesRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || mapObjRef.current) return

    const L = require('leaflet')

    // 日本全体が見えるズームレベル
    const map = L.map(mapRef.current!, {
      center: [36.5, 137.0],
      zoom: 5,
      zoomControl: false,
    })

    // 日本語ラベル対応タイル（CartoDB Voyager）
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>', maxZoom: 19 }
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

  // ピンマーカー更新
  useEffect(() => {
    if (!mapObjRef.current) return
    const L = require('leaflet')

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (layerMode !== 'pins') return

    reports.forEach(r => {
      const color  = INCIDENT_COLORS[r.data?.incident_type || ''] || '#6B7280'
      const nation = r.data?.nationality_type || '不明'

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
          ">${r.data?.incident_type || 'その他'}</div>
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            ${r.title || '（タイトルなし）'}
          </div>
          ${r.address ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📍 ${r.address}</div>` : ''}
          ${r.occurred_at ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📅 ${r.occurred_at}</div>` : ''}
          <div style="font-size: 11px; margin-top: 6px;">
            <span style="
              padding: 1px 6px;
              background: ${nation === '外国人' ? '#FF704333' : '#4FC3F733'};
              color: ${nation === '外国人' ? '#FF7043' : '#4FC3F7'};
              border-radius: 4px;
            ">${nation}</span>
          </div>
          ${r.data?.source_url ? `
            <a href="${r.data.source_url}" target="_blank" style="
              display: block; margin-top: 8px; font-size: 11px;
              color: #60a5fa; text-decoration: none;
            ">🔗 ソースを確認</a>` : ''}
        </div>
      `)

      const marker = L.marker([r.lat, r.lng], { icon }).bindPopup(popup)
      marker.addTo(mapObjRef.current)
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
