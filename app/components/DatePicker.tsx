'use client'

import { useState, useEffect, useRef } from 'react'

type Props = {
  value:    string   // YYYY-MM-DD
  onChange: (val: string) => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

export default function DatePicker({ value, onChange }: Props) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const ref      = useRef<HTMLDivElement>(null)
  const [open, setOpen]     = useState(false)

  const parsed = value ? new Date(value + 'T00:00:00') : null
  const init   = parsed ?? today

  const [viewYear,  setViewYear]  = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())

  // 外側クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectDate = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d)
    if (date > today) return
    onChange(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11) }
    else setViewMonth(m => m-1)
  }
  const nextMonth = () => {
    const next = new Date(viewYear, viewMonth+1, 1)
    if (next > today) return
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0) }
    else setViewMonth(m => m+1)
  }

  // カレンダーのセルを生成
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
  const cells: (number|null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_,i) => i+1)
  ]
  // 6行になるよう末尾を埋める
  while (cells.length % 7 !== 0) cells.push(null)

  const displayValue = value
    ? `${value.split('-')[0]}年${parseInt(value.split('-')[1])}月${parseInt(value.split('-')[2])}日`
    : '日付を選択'

  const isSelected = (d: number) => {
    if (!value) return false
    const [y,m,day] = value.split('-').map(Number)
    return y === viewYear && m-1 === viewMonth && day === d
  }

  const isFuture = (d: number) => new Date(viewYear, viewMonth, d) > today
  const isToday  = (d: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
  }

  const canNextMonth = new Date(viewYear, viewMonth+1, 1) <= today

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      {/* トリガーボタン */}
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: '#0a0f1a',
        border: `1px solid ${open ? '#4FC3F7' : '#1e2d40'}`,
        borderRadius: 6, padding: '9px 12px',
        color: value ? '#e2e8f0' : '#475569',
        fontSize: 13, outline: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'border-color 0.15s',
      }}>
        <span>{displayValue}</span>
        <span style={{ color: '#64748b', fontSize: 14 }}>📅</span>
      </button>

      {/* ポップアップ */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: '#111827', border: '1px solid #1e2d40',
          borderRadius: 10, padding: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 260,
        }}>
          {/* ヘッダー（月移動） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>‹</button>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
              {viewYear}年 {MONTHS[viewMonth]}
            </div>
            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', color: canNextMonth ? '#94a3b8' : '#334155', cursor: canNextMonth ? 'pointer' : 'not-allowed', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>›</button>
          </div>

          {/* 曜日ヘッダー */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{
                textAlign: 'center', fontSize: 10, fontWeight: 600, padding: '3px 0',
                color: i === 0 ? '#f87171' : i === 6 ? '#60a5fa' : '#64748b',
              }}>{w}</div>
            ))}
          </div>

          {/* 日付セル */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const future   = isFuture(d)
              const selected = isSelected(d)
              const todayCell = isToday(d)
              const dow = i % 7
              return (
                <button key={i} type="button"
                  onClick={() => !future && selectDate(viewYear, viewMonth, d)}
                  style={{
                    background: selected ? '#4FC3F7' : todayCell ? '#1e2d40' : 'none',
                    border: todayCell && !selected ? '1px solid #4FC3F744' : '1px solid transparent',
                    borderRadius: 6,
                    color: future ? '#334155'
                         : selected ? '#0a0f1a'
                         : dow === 0 ? '#f87171'
                         : dow === 6 ? '#60a5fa'
                         : '#e2e8f0',
                    fontSize: 12, fontWeight: selected ? 700 : 400,
                    padding: '5px 0', cursor: future ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    transition: 'background 0.1s',
                  }}
                >{d}</button>
              )
            })}
          </div>

          {/* 今日ボタン */}
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button type="button" onClick={() => {
              const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
              setViewYear(y); setViewMonth(m)
              selectDate(y, m, d)
            }} style={{
              background: 'none', border: '1px solid #1e2d40',
              borderRadius: 4, padding: '4px 12px',
              color: '#64748b', fontSize: 11, cursor: 'pointer',
            }}>今日</button>
          </div>
        </div>
      )}
    </div>
  )
}
