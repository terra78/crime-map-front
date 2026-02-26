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
