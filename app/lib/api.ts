const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Report = {
  id: number
  title: string | null
  lat: number
  lng: number
  address: string | null
  occurred_at: string | null
  data: {
    incident_type?: string
    nationality_type?: string
    source_url?: string
  }
  site_type_id: number
}

export type PrefectureStat = {
  id: number
  year: number
  prefecture_code: string
  prefecture_name: string
  crime_category: string
  crime_type: string | null
  count_recognized: number
  count_cleared: number | null
  count_arrested: number | null
  lat: number
  lng: number
}

export async function fetchReports(params?: {
  site_type_id?: number
  min_lat?: number
  max_lat?: number
  min_lng?: number
  max_lng?: number
}): Promise<Report[]> {
  const query = new URLSearchParams()
  if (params?.site_type_id) query.set('site_type_id', String(params.site_type_id))
  if (params?.min_lat) query.set('min_lat', String(params.min_lat))
  if (params?.max_lat) query.set('max_lat', String(params.max_lat))
  if (params?.min_lng) query.set('min_lng', String(params.min_lng))
  if (params?.max_lng) query.set('max_lng', String(params.max_lng))
  const res = await fetch(`${API_BASE}/api/reports?${query}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchPrefectureStats(params?: {
  year?: number
  crime_category?: string
}): Promise<PrefectureStat[]> {
  const query = new URLSearchParams()
  if (params?.year) query.set('year', String(params.year))
  if (params?.crime_category) query.set('crime_category', params.crime_category)
  const res = await fetch(`${API_BASE}/api/prefecture_stats?${query}`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchPrefectureYears(): Promise<number[]> {
  const res = await fetch(`${API_BASE}/api/prefecture_stats/years`)
  if (!res.ok) return []
  return res.json()
}

export async function fetchPrefectureCategories(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/prefecture_stats/categories`)
  if (!res.ok) return []
  return res.json()
}
