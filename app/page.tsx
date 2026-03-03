'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/nextjs'
import {
  fetchReports, Report,
  fetchPrefectureStats, PrefectureStat,
  fetchPrefectureYears, fetchPrefectureCategories,
} from './lib/api'
import Sidebar from './components/Sidebar'
import { INCIDENT_TO_CATEGORY } from './lib/crimeTypes'

// Leafletはサーバーサイドレンダリング不可なのでdynamic import
const Map = dynamic(() => import('./components/Map'), { ssr: false })

type SearchTarget = { lat: number; lng: number; zoom?: number } | null

export default function Home() {
  const { userId } = useAuth()

  // ───── 投稿ピン state ─────
  const [allReports, setAllReports] = useState<Report[]>([])
  const [loading, setLoading]       = useState(false)
  const [filter, setFilter] = useState({
    crime_category: '全て',
    nationality_type: '全て',
  })

  // ───── 地図検索 state ─────
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searching,    setSearching]    = useState(false)
  const [searchError,  setSearchError]  = useState('')
  const [searchTarget, setSearchTarget] = useState<SearchTarget>(null)

  // ───── レイヤー切り替え state ─────
  const [layerMode, setLayerMode] = useState<'pins' | 'bubbles'>('pins')

  // ───── 都道府県統計 state ─────
  const [prefectureStats, setPrefectureStats]     = useState<PrefectureStat[]>([])
  const [prefYears, setPrefYears]                 = useState<number[]>([])
  const [prefCategories, setPrefCategories]       = useState<string[]>([])
  const [prefYear, setPrefYear]                   = useState<number | null>(null)
  const [prefCategory, setPrefCategory]           = useState<string>('全て')
  const [prefLoading, setPrefLoading]             = useState(false)

  // ───── 投稿ピン 初回取得 ─────
  useEffect(() => {
    fetchReports({ site_type_id: 1 }).then(data => {
      setAllReports(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // ───── 都道府県統計メタ（年・罪種一覧）を初回取得 ─────
  useEffect(() => {
    Promise.all([fetchPrefectureYears(), fetchPrefectureCategories()]).then(
      ([years, categories]) => {
        setPrefYears(years)
        setPrefCategories(categories)
        if (years.length > 0) setPrefYear(Math.max(...years))
      }
    )
  }, [])

  // ───── 都道府県統計データ取得（年 or 罪種が変わるたびに） ─────
  useEffect(() => {
    if (layerMode !== 'bubbles') return
    setPrefLoading(true)
    fetchPrefectureStats({
      year: prefYear ?? undefined,
      crime_category: prefCategory === '全て' ? undefined : prefCategory,
    }).then(data => {
      setPrefectureStats(data)
      setPrefLoading(false)
    })
  }, [layerMode, prefYear, prefCategory])

  const handleLayerModeChange = useCallback((mode: 'pins' | 'bubbles') => {
    setLayerMode(mode)
  }, [])

  // ───── 地図検索（Nominatim）─────
  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true); setSearchError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&accept-language=ja&limit=1`,
        { headers: { 'User-Agent': 'CrimeMapJapan/1.0' } }
      )
      const data = await res.json()
      if (!data.length) { setSearchError('場所が見つかりませんでした'); return }
      setSearchTarget({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), zoom: 13 })
      setSearchError('')
    } catch { setSearchError('検索に失敗しました') }
    finally { setSearching(false) }
  }

  // ───── 投稿ピン フィルタリング ─────
  const filteredReports = allReports.filter(r => {
    if (filter.crime_category !== '全て') {
      // crime_category が保存されていない旧データは incident_type から導出
      const cat =
        r.data?.crime_category ||
        INCIDENT_TO_CATEGORY[r.data?.incident_type ?? ''] ||
        'その他の刑法犯'
      if (cat !== filter.crime_category) return false
    }
    if (filter.nationality_type !== '全て') {
      const nat = r.data?.nationality_type
      if (filter.nationality_type === '日本人') {
        if (nat !== '日本') return false
      } else if (filter.nationality_type === '外国人') {
        if (!nat || nat === '日本' || nat === '不明') return false
      }
    }
    return true
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0f1a',
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      {/* サイドバー */}
      <Sidebar
        reports={filteredReports}
        filter={filter}
        onFilterChange={setFilter}
        layerMode={layerMode}
        onLayerModeChange={handleLayerModeChange}
        prefYear={prefYear}
        prefYears={prefYears}
        onPrefYearChange={setPrefYear}
        prefCategory={prefCategory}
        prefCategories={prefCategories}
        onPrefCategoryChange={setPrefCategory}
        prefLoading={prefLoading}
      />

      {/* 地図エリア（サイドバーの右側） */}
      <div style={{
        position: 'absolute', inset: 0,
        marginLeft: '280px',
        transition: 'margin-left 0.25s ease',
      }}>
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#64748b', fontSize: 14,
          }}>
            <div>データを読み込み中...</div>
          </div>
        ) : (
          <Map
            reports={filteredReports}
            prefectureStats={prefectureStats}
            layerMode={layerMode}
            searchTarget={searchTarget}
            currentUserId={userId ?? null}
          />
        )}

        {/* 地図上の検索バーオーバーレイ */}
        <div style={{
          position: 'absolute', top: 16, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000, width: '100%', maxWidth: 420, padding: '0 16px',
        }}>
          <form onSubmit={handleMapSearch} style={{ display: 'flex', gap: 6 }}>
            <input
              style={{
                flex: 1, minWidth: 0,
                background: 'rgba(15,25,35,0.92)',
                border: '1px solid #1e3a5f',
                borderRadius: 8, padding: '9px 14px',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
              placeholder="🔍 住所・地名で検索（例: 新宿区、大阪城）"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchError('') }}
            />
            <button type="submit" disabled={searching} style={{
              padding: '9px 16px',
              background: searching ? '#1e3a5f' : '#4FC3F7',
              color: '#0a0f1a',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: searching ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              {searching ? '…' : '検索'}
            </button>
          </form>
          {searchError && (
            <div style={{
              marginTop: 6, padding: '6px 12px',
              background: 'rgba(239,68,68,0.15)', border: '1px solid #EF444466',
              borderRadius: 6, color: '#f87171', fontSize: 12,
            }}>
              {searchError}
            </div>
          )}
        </div>
      </div>

      {/* 右上：認証 + 投稿ボタン */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1001,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <SignedOut>
          <SignInButton mode="modal">
            <button style={{
              padding: '7px 14px',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #1e2d40',
              borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}>
              ログイン
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <a href="/my-reports" style={{
            padding: '7px 12px',
            background: '#111827',
            color: '#ffffff',
            border: '1px solid #374151',
            borderRadius: 6, fontSize: 13,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            マイ投稿
          </a>
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 32, height: 32 },
              },
            }}
          />
        </SignedIn>
        <a href="/submit" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px',
          background: '#FF7043', color: 'white',
          borderRadius: 6, textDecoration: 'none',
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 2px 12px rgba(255,112,67,0.4)',
        }}>
          ＋ 投稿する
        </a>
      </div>

      {/* 右下：データについて */}
      <div style={{
        position: 'absolute', bottom: 32, right: 16, zIndex: 1001,
        fontSize: 10, color: '#334155', textAlign: 'right',
      }}>
        ※ ユーザー投稿および公開情報に基づくデータです
      </div>
    </div>
  )
}
