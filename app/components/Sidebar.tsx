'use client'

import { useState } from 'react'
import { Report } from '../lib/api'

const INCIDENT_COLORS: Record<string, string> = {
  '交通事故': '#F59E0B',
  '窃盗':    '#EF4444',
  '暴行':    '#DC2626',
  '詐欺':    '#8B5CF6',
  'その他':  '#6B7280',
}

type Props = {
  reports: Report[]
  filter: { incident_type: string; nationality_type: string }
  onFilterChange: (f: { incident_type: string; nationality_type: string }) => void
}

export default function Sidebar({ reports, filter, onFilterChange }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const jp  = reports.filter(r => r.data?.nationality_type === '日本人').length
  const fg  = reports.filter(r => r.data?.nationality_type === '外国人').length
  const total = reports.length

  const categoryCounts = reports.reduce((acc, r) => {
    const t = r.data?.incident_type || 'その他'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0,
      width: collapsed ? '48px' : '280px',
      background: '#0a0f1a',
      borderRight: '1px solid #1e2d40',
      transition: 'width 0.25s ease',
      zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '16px 12px',
        borderBottom: '1px solid #1e2d40',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <div style={{
          width: 4, height: 20,
          background: '#FF7043', borderRadius: 2, flexShrink: 0,
        }} />
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: '#e2e8f0', letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
            }}>犯罪マップ</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>CRIME MAP JAPAN</div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', fontSize: 16, padding: 2, flexShrink: 0,
        }}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* 統計サマリー */}
          <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
              表示中の件数
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1, background: '#111827', borderRadius: 6,
                padding: '8px', border: '1px solid #1e2d40', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
                  {total}
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>総件数</div>
              </div>
              <div style={{
                flex: 1, background: '#111827', borderRadius: 6,
                padding: '8px', border: '1px solid #1e2d40', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#4FC3F7', fontFamily: 'monospace' }}>
                  {jp}
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>日本人</div>
              </div>
              <div style={{
                flex: 1, background: '#111827', borderRadius: 6,
                padding: '8px', border: '1px solid #1e2d40', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#FF7043', fontFamily: 'monospace' }}>
                  {fg}
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>外国人</div>
              </div>
            </div>
          </div>

          {/* フィルター：国籍 */}
          <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
              国籍フィルター
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['全て', '日本人', '外国人'].map(n => (
                <button key={n} onClick={() => onFilterChange({ ...filter, nationality_type: n })}
                  style={{
                    flex: 1, padding: '5px 4px', fontSize: 11,
                    border: `1px solid ${filter.nationality_type === n ? '#FF7043' : '#1e2d40'}`,
                    background: filter.nationality_type === n ? '#FF704322' : '#111827',
                    color: filter.nationality_type === n ? '#FF7043' : '#64748b',
                    borderRadius: 4, cursor: 'pointer',
                  }}>{n}</button>
              ))}
            </div>
          </div>

          {/* フィルター：種別 */}
          <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
              種別フィルター
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['全て', '交通事故', '窃盗', '暴行', '詐欺', 'その他'].map(t => {
                const color = INCIDENT_COLORS[t] || '#e2e8f0'
                const count = t === '全て' ? total : (categoryCounts[t] || 0)
                return (
                  <button key={t} onClick={() => onFilterChange({ ...filter, incident_type: t })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', fontSize: 11,
                      border: `1px solid ${filter.incident_type === t ? color : '#1e2d40'}`,
                      background: filter.incident_type === t ? `${color}22` : '#111827',
                      color: filter.incident_type === t ? color : '#94a3b8',
                      borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                    }}>
                    {t !== '全て' && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: color, flexShrink: 0,
                      }} />
                    )}
                    <span style={{ flex: 1 }}>{t}</span>
                    <span style={{ fontFamily: 'monospace', color: '#475569' }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 凡例 */}
          <div style={{ padding: '12px', marginTop: 'auto', borderTop: '1px solid #1e2d40' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, letterSpacing: '0.1em' }}>
              凡例
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  background: '#111827', border: '2px solid #4FC3F7', borderRadius: '50%',
                }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>日本人</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  background: '#111827', border: '2px solid #FF7043', borderRadius: '50%',
                }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>外国人</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
