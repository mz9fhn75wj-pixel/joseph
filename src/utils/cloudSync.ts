import type { GameState } from '../types'

const SESSION_KEY = 'cultivation-companion-cloud-session-v1'
const MUSIC_SETTINGS_KEY = 'cultivation-companion-cloud-music-settings-v1'
const SESSION_EVENT = 'cultivation-companion-cloud-session-changed'

export interface CloudSession {
  accessToken: string
  refreshToken: string
  userId: string
  email: string
  expiresAt?: number
}

export interface CloudMusicSettings {
  order: string[]
  names: Record<string, string>
  currentTrackId: string
  playMode: 'sequential' | 'shuffle'
  volume: number
}

export interface CloudSnapshot {
  state: GameState
  musicSettings?: CloudMusicSettings
  updatedAt: string
}

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')

export const cloudSyncConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function jsonHeaders(token?: string) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token ?? supabaseAnonKey}`,
    'Content-Type': 'application/json',
  }
}

function readSession(): CloudSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<CloudSession> | null
    return value?.accessToken && value.refreshToken && value.userId && value.email ? value as CloudSession : null
  } catch {
    return null
  }
}

export function getCloudSession() {
  return readSession()
}

function setCloudSession(session: CloudSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: session }))
}

export function onCloudSessionChange(listener: (session: CloudSession | null) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<CloudSession | null>).detail ?? null)
  window.addEventListener(SESSION_EVENT, handler)
  return () => window.removeEventListener(SESSION_EVENT, handler)
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.msg === 'string') return record.msg
    if (typeof record.error_description === 'string') return record.error_description
    if (typeof record.message === 'string') return record.message
  }
  return fallback
}

async function requestJson<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const error = new Error(getErrorMessage(body, fallback)) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return body as T
}

type AuthResponse = { access_token: string; refresh_token?: string; expires_in?: number; user?: { id: string; email?: string } }

function sessionFromAuthResponse(body: AuthResponse, previous: CloudSession, email = previous.email): CloudSession {
  return {
    ...previous,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? previous.refreshToken,
    email: body.user?.email ?? email,
    expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : previous.expiresAt,
  }
}

async function refreshCloudSession(session: CloudSession) {
  const body = await requestJson<AuthResponse>(
    `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    { method: 'POST', headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refreshToken }) },
    '登入狀態已過期，請重新登入。',
  )
  const refreshed = sessionFromAuthResponse(body, session)
  setCloudSession(refreshed)
  return refreshed
}

async function ensureFreshSession(session: CloudSession) {
  if (session.expiresAt && session.expiresAt > Date.now() + 60_000) return session
  return refreshCloudSession(session)
}

async function requestWithSession<T>(session: CloudSession, request: (validSession: CloudSession) => [string, RequestInit], fallback: string) {
  let validSession = await ensureFreshSession(session)
  try {
    const [url, init] = request(validSession)
    return await requestJson<T>(url, init, fallback)
  } catch (error) {
    if (!(error instanceof Error) || (error as Error & { status?: number }).status !== 401) throw error
    validSession = await refreshCloudSession(validSession)
    const [url, init] = request(validSession)
    return requestJson<T>(url, init, fallback)
  }
}

export async function signInCloud(email: string, password: string) {
  if (!cloudSyncConfigured) throw new Error('尚未設定雲端同步服務')
  const body = await requestJson<AuthResponse & { refresh_token: string; user: { id: string; email?: string } }>(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    { method: 'POST', headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    '登入失敗，請確認電子郵件與密碼。',
  )
  const session: CloudSession = { accessToken: body.access_token, refreshToken: body.refresh_token, userId: body.user.id, email: body.user.email ?? email, expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined }
  setCloudSession(session)
  return session
}

export async function signUpCloud(email: string, password: string) {
  if (!cloudSyncConfigured) throw new Error('尚未設定雲端同步服務')
  const body = await requestJson<AuthResponse>(
    `${supabaseUrl}/auth/v1/signup`,
    { method: 'POST', headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    '註冊失敗，請確認電子郵件格式。',
  )
  if (!body.access_token || !body.refresh_token || !body.user) return null
  const session: CloudSession = { accessToken: body.access_token, refreshToken: body.refresh_token, userId: body.user.id, email: body.user.email ?? email, expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined }
  setCloudSession(session)
  return session
}

export function signOutCloud() {
  setCloudSession(null)
  localStorage.removeItem(MUSIC_SETTINGS_KEY)
}

export async function loadCloudSnapshot(session = getCloudSession()) {
  if (!session) return null
  const rows = await requestWithSession<Array<{ state: GameState; music_settings?: CloudMusicSettings; updated_at: string }>>(session, (validSession) => [`${supabaseUrl}/rest/v1/cloud_saves?select=state,music_settings,updated_at&user_id=eq.${encodeURIComponent(validSession.userId)}&limit=1`, { headers: jsonHeaders(validSession.accessToken) }], '無法讀取雲端存檔。')
  const row = rows[0]
  if (!row) return null
  if (row.music_settings) localStorage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(row.music_settings))
  return { state: row.state, musicSettings: row.music_settings, updatedAt: row.updated_at } satisfies CloudSnapshot
}

export async function saveCloudSnapshot(state: GameState, musicSettings?: CloudMusicSettings, session = getCloudSession()) {
  if (!session) return
  await requestWithSession(session, (validSession) => [`${supabaseUrl}/rest/v1/cloud_saves?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...jsonHeaders(validSession.accessToken), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: validSession.userId, state, music_settings: musicSettings ?? readCloudMusicSettings(), updated_at: new Date().toISOString() }),
  }], '雲端存檔寫入失敗。')
}

export function readCloudMusicSettings(): CloudMusicSettings | undefined {
  try { return JSON.parse(localStorage.getItem(MUSIC_SETTINGS_KEY) ?? 'null') as CloudMusicSettings | undefined } catch { return undefined }
}

export async function saveCloudMusicSettings(settings: CloudMusicSettings, session = getCloudSession()) {
  localStorage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(settings))
  if (!session) return
  const snapshot = await loadCloudSnapshot(session)
  const currentSession = getCloudSession() ?? session
  if (snapshot) await saveCloudSnapshot(snapshot.state, settings, currentSession)
}

export async function listCloudMusic(session = getCloudSession()) {
  if (!session) return []
  return requestWithSession<Array<{ track_id: string; name: string; created_at: number }>>(session, (validSession) => [`${supabaseUrl}/rest/v1/cloud_music?select=track_id,name,created_at&user_id=eq.${encodeURIComponent(validSession.userId)}&order=created_at.asc`, { headers: jsonHeaders(validSession.accessToken) }], '無法讀取雲端歌單。').then((rows) => rows.map((row) => ({ id: row.track_id, name: row.name, createdAt: Number(row.created_at) || Date.now() })))
}

export async function deleteCloudMusic(trackId: string, session = getCloudSession()) {
  if (!session) return
  let validSession = await ensureFreshSession(session)
  const deleteStorage = (current: CloudSession) => fetch(`${supabaseUrl}/storage/v1/object/music/${current.userId}/${encodeURIComponent(trackId)}.mp3`, { method: 'DELETE', headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${current.accessToken}` } })
  let storageResponse = await deleteStorage(validSession)
  if (storageResponse.status === 401) {
    validSession = await refreshCloudSession(validSession)
    storageResponse = await deleteStorage(validSession)
  }
  if (!storageResponse.ok && storageResponse.status !== 404) throw new Error('雲端 MP3 刪除失敗。')
  await requestWithSession(validSession, (current) => [`${supabaseUrl}/rest/v1/cloud_music?user_id=eq.${encodeURIComponent(current.userId)}&track_id=eq.${encodeURIComponent(trackId)}`, { method: 'DELETE', headers: { ...jsonHeaders(current.accessToken), Prefer: 'return=minimal' } }], '雲端歌單資料刪除失敗。')
}

