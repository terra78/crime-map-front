const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type Report = {
  id: number
  title: string | null
  lat: number
  lng: number
  address: string | null
  occurred_at: string | null
  source_url: string | null
  archive_url: string | null
  data: {
    incident_type?: string
    crime_category?: string
    crime_law?: string
    nationality_type?: string
    original_report_id?: number
    corrected_by_report?: number
  }
  site_type_id: number
  status?: 'pending' | 'ai_approved' | 'human_approved' | 'rejected' | 'corrected'
  submitted_by?: string
  created_at?: string
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
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000) // 15秒タイムアウト
    const query = new URLSearchParams()
    if (params?.site_type_id) query.set('site_type_id', String(params.site_type_id))
    if (params?.min_lat) query.set('min_lat', String(params.min_lat))
    if (params?.max_lat) query.set('max_lat', String(params.max_lat))
    if (params?.min_lng) query.set('min_lng', String(params.min_lng))
    if (params?.max_lng) query.set('max_lng', String(params.max_lng))
    const res = await fetch(`${API_BASE}/api/reports?${query}`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function fetchReportById(id: number): Promise<Report | null> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${id}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function fetchMyReports(token: string): Promise<Report[]> {
  const res = await fetch(`${API_BASE}/api/reports/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return res.json()
}

export type ReportUpdatePayload = {
  title?: string
  description?: string
  address?: string
  occurred_at?: string | null
  source_url?: string | null
  data?: Record<string, string>
  lat?: number
  lng?: number
}

export async function updateMyReport(
  token: string,
  id: number,
  payload: ReportUpdatePayload,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteMyReport(token: string, id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
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

// ── Comments API ─────────────────────────────────────────────────────────────

export type Comment = {
  id: number
  report_id: number
  user_id: string
  user_name: string | null
  user_avatar: string | null
  content: string
  parent_id: number | null
  created_at: string
}

export async function fetchComments(reportId: number): Promise<Comment[]> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/comments`)
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function postComment(
  reportId: number,
  token: string,
  body: { content: string; user_name?: string; user_avatar?: string; parent_id?: number },
): Promise<Comment | null> {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ── Contact API ───────────────────────────────────────────────────────────────

export async function submitContact(body: { contact_type: string; detail: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch { return false }
}

// ── Admin API ────────────────────────────────────────────────────────────────

export type AdminReport = {
  id: number
  title: string | null
  description: string | null
  source_url: string | null
  archive_url: string | null
  ai_score: number | null
  ai_reason: string | null
  data: Record<string, string>
  created_at: string
}

export type AdminStats = {
  total: number
  approved: number
  pending: number
  rejected: number
}

function adminHeaders(token: string) {
  return { 'x-admin-token': token }
}

export async function fetchAdminQueue(token: string): Promise<AdminReport[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/queue`, { headers: adminHeaders(token) })
    if (res.status === 401) return null
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function fetchAdminStats(token: string): Promise<AdminStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: adminHeaders(token) })
    if (res.status === 401) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function adminApprove(token: string, id: number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/approve/${id}`, {
    method: 'POST',
    headers: adminHeaders(token),
  })
  return res.ok
}

export async function adminReject(token: string, id: number): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/admin/reject/${id}`, {
    method: 'POST',
    headers: adminHeaders(token),
  })
  return res.ok
}

export async function adminRejectExcludeKeywords(
  token: string
): Promise<{ rejected_count: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/reject/exclude-keywords`, {
      method: 'POST',
      headers: adminHeaders(token),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export type AdminProfile = { id: number; email: string; created_at: string }

export async function fetchAdminProfile(token: string): Promise<AdminProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/profile`, { headers: adminHeaders(token) })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function updateAdminProfile(token: string, email: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/profile`, {
      method: 'PATCH',
      headers: { ...adminHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.ok
  } catch { return false }
}

export async function adminDeleteReport(token: string, id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/reports/${id}`, {
      method: 'DELETE',
      headers: adminHeaders(token),
    })
    return res.ok
  } catch { return false }
}
