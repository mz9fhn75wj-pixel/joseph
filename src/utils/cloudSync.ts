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

export interface CloudMusicTrack {
  id: string
  name: string
  src: string
  createdAt: number
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

function musicSettingsKey(ownerId?: string) {
  return ownerId ? `${MUSIC_SETTINGS_KEY}:${ownerId}` : MUSIC_SETTINGS_KEY
}

function makeSession(body: { access_token: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id?: string; email?: string } }, previous?: CloudSession, email?: string): CloudSession {
  const expiresAt = body.expires_at ? body.expires_at * 1000 : body.expires_in ? Date.now() + body.expires_in * 1000 : previous?.expiresAt
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? previous?.refreshToken ?? '',
    userId: body.user?.id ?? previous?.userId ?? '',
    email: body.user?.email ?? previous?.email ?? email ?? '',
    ...(expiresAt ? { expiresAt } : {}),
  }
}

async function ensureFreshSession(session: CloudSession): Promise<CloudSession> {
  // Old sessions without an expiry are refreshed once so an expired token
  // cannot silently break background synchronization.
  if (session.expiresAt && session.expiresAt > Date.now() + 60_000) return session
  const body = await requestJson<{ access_token: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id?: string; email?: string } }>(
    `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    { method: 'POST', headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refreshToken }) },
    '雲端登入已過期，請重新登入。',
  )
  const refreshed = makeSession(body, session)
  if (!refreshed.userId || !refreshed.refreshToken) throw new Error('雲端登入已過期，請重新登入。')
  setCloudSession(refreshed)
  return refreshed
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
  const errorMessage = getErrorMessage(body, fallback)
  const isExpired = response.status === 401 || /jwt|token|expired|unauthorized/i.test(errorMessage)
  if (!response.ok) {
    if (isExpired) {
      setCloudSession(null)
      throw new Error('雲端登入已過期，請重新登入後再同步。')
    }
    throw new Error(errorMessage)
  }
  return body as T
}

export async function signInCloud(email: string, password: string) {
  if (!cloudSyncConfigured) throw new Error('尚未設定雲端同步服務')
  const body = await requestJson<{ access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user: { id: string; email?: string } }>(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    { method: 'POST', headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    '登入失敗，請確認電子郵件與密碼。',
  )
  const session = makeSession(body, undefined, email)
  setCloudSession(session)
  return session
}

export async function signUpCloud(email: string, password: string) {
  if (!cloudSyncConfigured) throw new Error('尚未設定雲端同步服務')
  const body = await requestJson<{ access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number; user?: { id: string; email?: string } }>(
    `${supabaseUrl}/auth/v1/signup`,
    { method: 'POST', headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) },
    '註冊失敗，請確認電子郵件格式。',
  )
  if (!body.access_token || !body.refresh_token || !body.user) return null
  const session = makeSession(body as { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user: { id: string; email?: string } }, undefined, email)
  setCloudSession(session)
  return session
}

export function signOutCloud() {
  setCloudSession(null)
  localStorage.removeItem(MUSIC_SETTINGS_KEY)
}

export async function loadCloudSnapshot(session = getCloudSession()) {
  if (!session) return null
  const validSession = await ensureFreshSession(session)
  const rows = await requestJson<Array<{ state: GameState; music_settings?: CloudMusicSettings; updated_at: string }>>(
    `${supabaseUrl}/rest/v1/cloud_saves?select=state,music_settings,updated_at&user_id=eq.${encodeURIComponent(validSession.userId)}&limit=1`,
    { headers: jsonHeaders(validSession.accessToken) },
    '無法讀取雲端存檔。',
  )
  const row = rows[0]
  if (!row) return null
  if (row.music_settings) localStorage.setItem(musicSettingsKey(validSession.userId), JSON.stringify(row.music_settings))
  return { state: row.state, musicSettings: row.music_settings, updatedAt: row.updated_at } satisfies CloudSnapshot
}

export async function saveCloudSnapshot(state: GameState, musicSettings?: CloudMusicSettings, session = getCloudSession()) {
  if (!session) return
  const validSession = await ensureFreshSession(session)
  await requestJson(`${supabaseUrl}/rest/v1/cloud_saves?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...jsonHeaders(validSession.accessToken), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: validSession.userId, state, music_settings: musicSettings ?? readCloudMusicSettings(validSession.userId), updated_at: new Date().toISOString() }),
  }, '雲端存檔寫入失敗。')
}

export function readCloudMusicSettings(ownerId?: string): CloudMusicSettings | undefined {
  try {
    const scoped = localStorage.getItem(musicSettingsKey(ownerId))
    const legacy = ownerId ? null : localStorage.getItem(MUSIC_SETTINGS_KEY)
    return JSON.parse(scoped ?? legacy ?? 'null') as CloudMusicSettings | undefined
  } catch { return undefined }
}

export async function saveCloudMusicSettings(settings: CloudMusicSettings, session = getCloudSession()) {
  localStorage.setItem(musicSettingsKey(session?.userId), JSON.stringify(settings))
  if (!session) return
  const validSession = await ensureFreshSession(session)
  const snapshot = await loadCloudSnapshot(validSession)
  if (snapshot) await saveCloudSnapshot(snapshot.state, settings, validSession)
}

function makeTrackId() {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `custom-${Date.now()}-${suffix}`
}

function storagePathUrl(path: string) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/')
}

function absoluteStorageUrl(url: string) {
  return url.startsWith('http') ? url : `${supabaseUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

export async function uploadCloudMusic(file: File, name: string, trackId = makeTrackId(), session = getCloudSession()): Promise<CloudMusicTrack> {
  if (!session) throw new Error('登入後才能將 MP3 同步到其他裝置。')
  const validSession = await ensureFreshSession(session)
  const storagePath = `${validSession.userId}/${trackId}.mp3`
  const headers = { apikey: supabaseAnonKey, Authorization: `Bearer ${validSession.accessToken}`, 'Content-Type': file.type || 'audio/mpeg', 'x-upsert': 'false' }
  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/music/${storagePathUrl(storagePath)}`, { method: 'POST', headers, body: file })
  if (!uploadResponse.ok) {
    if (uploadResponse.status === 401) setCloudSession(null)
    throw new Error(uploadResponse.status === 409 ? '這首 MP3 已存在，請重新選擇檔案。' : 'MP3 上傳失敗，請稍後再試。')
  }
  try {
    await requestJson(`${supabaseUrl}/rest/v1/cloud_music`, {
      method: 'POST',
      headers: { ...jsonHeaders(validSession.accessToken), Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: validSession.userId, track_id: trackId, name, created_at: Date.now(), storage_path: storagePath }),
    }, '雲端歌單資料寫入失敗。')
  } catch (error) {
    await fetch(`${supabaseUrl}/storage/v1/object/music/${storagePathUrl(storagePath)}`, { method: 'DELETE', headers: jsonHeaders(validSession.accessToken) }).catch(() => undefined)
    throw error
  }
  const signed = await requestJson<{ signedURL: string }>(`${supabaseUrl}/storage/v1/object/sign/music/${storagePathUrl(storagePath)}`, {
    method: 'POST', headers: jsonHeaders(validSession.accessToken), body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
  }, 'MP3 已上傳，但目前無法取得播放連結。')
  return { id: trackId, name, src: absoluteStorageUrl(signed.signedURL), createdAt: Date.now() }
}

export async function listCloudMusic(session = getCloudSession()) {
  if (!session) return []
  const validSession = await ensureFreshSession(session)
  const rows = await requestJson<Array<{ track_id: string; name: string; created_at: number; storage_path: string }>>(
    `${supabaseUrl}/rest/v1/cloud_music?select=track_id,name,created_at,storage_path&user_id=eq.${encodeURIComponent(validSession.userId)}&order=created_at.asc`,
    { headers: jsonHeaders(validSession.accessToken) },
    '無法讀取雲端歌單。',
  )
  return Promise.all(rows.map(async (row) => {
    const signed = await requestJson<{ signedURL: string }>(`${supabaseUrl}/storage/v1/object/sign/music/${storagePathUrl(row.storage_path)}`, {
      method: 'POST', headers: jsonHeaders(validSession.accessToken), body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    }, '無法取得雲端 MP3 播放連結。')
    return { id: row.track_id, name: row.name, src: absoluteStorageUrl(signed.signedURL), createdAt: Number(row.created_at) || Date.now() }
  }))
}

export async function deleteCloudMusic(trackId: string, session = getCloudSession()) {
  if (!session) return
  const validSession = await ensureFreshSession(session)
  const path = `${validSession.userId}/${encodeURIComponent(trackId)}.mp3`
  const storageResponse = await fetch(`${supabaseUrl}/storage/v1/object/music/${path}`, { method: 'DELETE', headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${validSession.accessToken}` } })
  if (!storageResponse.ok && storageResponse.status !== 404) throw new Error('雲端 MP3 刪除失敗。')
  await requestJson(`${supabaseUrl}/rest/v1/cloud_music?user_id=eq.${encodeURIComponent(validSession.userId)}&track_id=eq.${encodeURIComponent(trackId)}`, { method: 'DELETE', headers: { ...jsonHeaders(validSession.accessToken), Prefer: 'return=minimal' } }, '雲端歌單資料刪除失敗。')
}

