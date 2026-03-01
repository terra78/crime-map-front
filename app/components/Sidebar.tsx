'use client'

import { useState } from 'react'
import { Report } from '../lib/api'
import { ALL_CATEGORIES, CATEGORY_COLORS, INCIDENT_TO_CATEGORY } from '../lib/crimeTypes'

type Props = {
  reports: Report[]
  filter: { crime_category: string; nationality_type: string }
  onFilterChange: (f: { crime_category: string; nationality_type: string }) => void
  // レイヤー切り替え
  layerMode: 'pins' | 'bubbles'
  onLayerModeChange: (mode: 'pins' | 'bubbles') => void
  // 都道府県統計フィルター
  prefYear: number | null
  prefYears: number[]
  onPrefYearChange: (year: number) => void
  prefCategory: string
  prefCategories: string[]
  onPrefCategoryChange: (cat: string) => void
  prefLoading: boolean
}

export default function Sidebar({
  reports, filter, onFilterChange,
  layerMode, onLayerModeChange,
  prefYear, prefYears, onPrefYearChange,
  prefCategory, prefCategories, onPrefCategoryChange,
  prefLoading,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const jp    = reports.filter(r => r.data?.nationality_type === '日本').length
  const fg    = reports.filter(r => {
    const nat = r.data?.nationality_type
    return nat && nat !== '日本' && nat !== '不明'
  }).length
  const total = reports.length

  // 第2階層（crime_category）ごとの件数を集計
  const categoryCounts = reports.reduce((acc, r) => {
    // crime_category が保存されていない旧データは incident_type から導出
    const cat =
      r.data?.crime_category ||
      INCIDENT_TO_CATEGORY[r.data?.incident_type ?? ''] ||
      'その他の刑法犯'
    acc[cat] = (acc[cat] || 0) + 1
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
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* ───── レイヤー切り替え ───── */}
          <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
              表示レイヤー
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { mode: 'pins'    as const, label: '📍 投稿ピン' },
                { mode: 'bubbles' as const, label: '🔵 都道府県統計' },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => onLayerModeChange(mode)}
                  style={{
                    flex: 1, padding: '6px 4px', fontSize: 11,
                    border: `1px solid ${layerMode === mode ? '#FF7043' : '#1e2d40'}`,
                    background: layerMode === mode ? '#FF704322' : '#111827',
                    color: layerMode === mode ? '#FF7043' : '#64748b',
                    borderRadius: 4, cursor: 'pointer',
                    fontWeight: layerMode === mode ? 700 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* ───── 投稿ピンモード ───── */}
          {layerMode === 'pins' && (
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

              {/* フィルター：犯罪カテゴリ（第2階層） */}
              <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
                  種別フィルター
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* 全て */}
                  <button
                    onClick={() => onFilterChange({ ...filter, crime_category: '全て' })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', fontSize: 11,
                      border: `1px solid ${filter.crime_category === '全て' ? '#e2e8f0' : '#1e2d40'}`,
                      background: filter.crime_category === '全て' ? '#e2e8f022' : '#111827',
                      color: filter.crime_category === '全て' ? '#e2e8f0' : '#94a3b8',
                      borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1 }}>全て</span>
                    <span style={{ fontFamily: 'monospace', color: '#475569' }}>{total}</span>
                  </button>

                  {/* 第2階層カテゴリ */}
                  {ALL_CATEGORIES.map(cat => {
                    const color = CATEGORY_COLORS[cat] || '#6B7280'
                    const count = categoryCounts[cat] || 0
                    const active = filter.crime_category === cat
                    return (
                      <button
                        key={cat}
                        onClick={() => onFilterChange({ ...filter, crime_category: cat })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px', fontSize: 11,
                          border: `1px solid ${active ? color : '#1e2d40'}`,
                          background: active ? `${color}22` : '#111827',
                          color: active ? color : '#94a3b8',
                          borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: color, flexShrink: 0,
                        }} />
                        <span style={{ flex: 1 }}>{cat}</span>
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

          {/* ───── 都道府県統計モード ───── */}
          {layerMode === 'bubbles' && (
            <>
              {/* 年選択 */}
              <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
                  年
                </div>
                {prefYears.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#475569' }}>データなし</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {prefYears.map(y => (
                      <button
                        key={y}
                        onClick={() => onPrefYearChange(y)}
                        style={{
                          padding: '4px 10px', fontSize: 12,
                          border: `1px solid ${prefYear === y ? '#60a5fa' : '#1e2d40'}`,
                          background: prefYear === y ? '#60a5fa22' : '#111827',
                          color: prefYear === y ? '#60a5fa' : '#64748b',
                          borderRadius: 4, cursor: 'pointer',
                          fontWeight: prefYear === y ? 700 : 400,
                          fontFamily: 'monospace',
                        }}
                      >{y}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* 罪種選択 */}
              <div style={{ padding: '12px', borderBottom: '1px solid #1e2d40' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, letterSpacing: '0.1em' }}>
                  罪種
                </div>
                {prefCategories.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#475569' }}>データなし</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => onPrefCategoryChange('全て')}
                      style={{
                        padding: '5px 8px', fontSize: 11, textAlign: 'left',
                        border: `1px solid ${prefCategory === '全て' ? '#FF7043' : '#1e2d40'}`,
                        background: prefCategory === '全て' ? '#FF704322' : '#111827',
                        color: prefCategory === '全て' ? '#FF7043' : '#94a3b8',
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >全て（合計）</button>
                    {prefCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => onPrefCategoryChange(cat)}
                        style={{
                          padding: '5px 8px', fontSize: 11, textAlign: 'left',
                          border: `1px solid ${prefCategory === cat ? '#FF7043' : '#1e2d40'}`,
                          background: prefCategory === cat ? '#FF704322' : '#111827',
                          color: prefCategory === cat ? '#FF7043' : '#94a3b8',
                          borderRadius: 4, cursor: 'pointer',
                        }}
                      >{cat}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* ローディング表示 */}
              {prefLoading && (
                <div style={{
                  padding: '12px', fontSize: 11, color: '#475569', textAlign: 'center',
                }}>
                  データ取得中…
                </div>
              )}

              {/* バブル凡例 */}
              <div style={{ padding: '12px', marginTop: 'auto', borderTop: '1px solid #1e2d40' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, letterSpacing: '0.1em' }}>
                  凡例（認知件数）
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {[
                    { r: 8,  label: '少' },
                    { r: 14, label: '中' },
                    { r: 20, label: '多' },
                  ].map(({ r, label }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{
                        display: 'inline-block',
                        width: r * 2, height: r * 2,
                        background: 'rgba(255,80,20,0.5)',
                        border: '1.5px solid rgba(255,80,20,0.9)',
                        borderRadius: '50%',
                      }} />
                      <span style={{ fontSize: 9, color: '#64748b' }}>{label}</span>
                    </div>
                  ))}
                  <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>
                    （バブルサイズ ∝ 件数）
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
