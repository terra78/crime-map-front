'use client'

import { useEffect, useRef, useState } from 'react'
import { Report } from '../lib/api'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故': '#F59E0B',
  '窃盗':    '#EF4444',
  '暴行':    '#DC2626',
  '詐欺':    '#8B5CF6',
  'その他':  '#6B7280',
}

const NATIONALITY_ICONS: Record<string, string> = {
  '日本人':  '🔵',
  '外国人':  '🔴',
  '不明':    '⚪',
}

type Props = {
  reports: Report[]
  onBoundsChange?: (bounds: {
    min_lat: number; max_lat: number
    min_lng: number; max_lng: number
  }) => void
}

export default function Map({ reports, onBoundsChange }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || mapObjRef.current) return

    const L = require('leaflet')

    // 日本全体が見えるズームレベル
    const map = L.map(mapRef.current!, {
      center: [36.5, 137.0],
      zoom: 5,
      zoomControl: false,
    })

    // ダークテーマタイル
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }
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

  // マーカー更新
  useEffect(() => {
    if (!mapObjRef.current) return
    const L = require('leaflet')

    // 既存マーカーを削除
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

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
  }, [reports])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
