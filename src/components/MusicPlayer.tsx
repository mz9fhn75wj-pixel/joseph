import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { deleteCloudMusic, getCloudSession, listCloudMusic, onCloudSessionChange, readCloudMusicSettings, saveCloudMusicSettings, uploadCloudMusic, type CloudMusicSettings, type CloudMusicTrack } from '../utils/cloudSync'
import { builtInMusicTracks } from '../data/musicLibrary'

type PlayMode = 'sequential' | 'shuffle'

interface MusicTrack {
  id: string
  name: string
  src: string
  local: boolean
  createdAt: number
}

interface StoredMusicTrack {
  id: string
  name: string
  blob: Blob
  createdAt: number
  ownerId?: string
}

interface DockPosition {
  left: number
  top: number
}

const MUSIC_MODE_KEY = 'cultivation-companion-music-mode-v1'
const MUSIC_TRACK_KEY = 'cultivation-companion-current-track-v1'
const MUSIC_VOLUME_KEY = 'cultivation-companion-music-volume-v1'
const MUSIC_ORDER_KEY = 'cultivation-companion-music-order-v1'
const MUSIC_NAMES_KEY = 'cultivation-companion-music-names-v1'
const TRACK_GAP_MS = 2000
const PRIMARY_MUSIC_ACCOUNT = 'shih77213@gmail.com'
const MUSIC_DB_NAME = 'cultivation-companion-music-v1'
const MUSIC_STORE_NAME = 'tracks'
const builtInTracks = builtInMusicTracks as MusicTrack[]
const defaultTrack = builtInTracks[0]

function isPrimaryMusicAccount(session: ReturnType<typeof getCloudSession>) {
  return session?.email.trim().toLowerCase() === PRIMARY_MUSIC_ACCOUNT
}

function musicStorageKey(key: string, ownerId?: string) {
  return ownerId ? `${key}:${ownerId}` : key
}

function openMusicDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(MUSIC_DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(MUSIC_STORE_NAME, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readStoredTracks() {
  return openMusicDatabase().then((database) => new Promise<StoredMusicTrack[]>((resolve, reject) => {
    const request = database.transaction(MUSIC_STORE_NAME, 'readonly').objectStore(MUSIC_STORE_NAME).getAll()
    request.onsuccess = () => { database.close(); resolve(request.result as StoredMusicTrack[]) }
    request.onerror = () => { database.close(); reject(request.error) }
  }))
}

function saveStoredTrack(track: StoredMusicTrack) {
  return openMusicDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const request = database.transaction(MUSIC_STORE_NAME, 'readwrite').objectStore(MUSIC_STORE_NAME).put(track)
    request.onsuccess = () => { database.close(); resolve() }
    request.onerror = () => { database.close(); reject(request.error) }
  }))
}

function deleteStoredTrack(trackId: string) {
  return openMusicDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const request = database.transaction(MUSIC_STORE_NAME, 'readwrite').objectStore(MUSIC_STORE_NAME).delete(trackId)
    request.onsuccess = () => { database.close(); resolve() }
    request.onerror = () => { database.close(); reject(request.error) }
  }))
}

function readPlayMode(ownerId?: string): PlayMode {
  return localStorage.getItem(musicStorageKey(MUSIC_MODE_KEY, ownerId)) === 'shuffle' ? 'shuffle' : 'sequential'
}

function readVolume(ownerId?: string) {
  const value = Number(localStorage.getItem(musicStorageKey(MUSIC_VOLUME_KEY, ownerId)))
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

function readTrackOrder(ownerId?: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(musicStorageKey(MUSIC_ORDER_KEY, ownerId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function readTrackNames(ownerId?: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(musicStorageKey(MUSIC_NAMES_KEY, ownerId)) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
  } catch {
    return {}
  }
}

function applySavedOrder(tracks: MusicTrack[], order: string[]) {
  const byId = new Map(tracks.map((track) => [track.id, track]))
  const seen = new Set<string>()
  const ordered: MusicTrack[] = []
  for (const id of order) {
    const track = byId.get(id)
    if (!track || seen.has(track.id)) continue
    seen.add(track.id)
    ordered.push(track)
  }
  return [...ordered, ...tracks.filter((track) => !seen.has(track.id))]
}

export function MusicPlayer({ soundEnabled }: { soundEnabled: boolean }) {
  const initialSession = getCloudSession()
  const initialOwnerId = initialSession?.userId
  const savedTrackId = useRef(localStorage.getItem(musicStorageKey(MUSIC_TRACK_KEY, initialOwnerId)) ?? defaultTrack.id)
  const savedOrder = useRef(readTrackOrder(initialOwnerId))
  const savedNames = useRef(readTrackNames(initialOwnerId))
  const objectUrlsRef = useRef<string[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  const nextTimerRef = useRef<number | null>(null)
  const audioRecoveryRef = useRef(false)
  // Keep the user's intention separate from the browser's transient playback
  // state. iOS can emit a pause event while Safari is moving to the
  // background, even though the user never asked the music to stop.
  const playbackIntentRef = useRef(false)
  const libraryLoadRef = useRef(0)
  const settingsTimerRef = useRef<number | null>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const playlistDragIndexRef = useRef<number | null>(null)
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playMode, setPlayMode] = useState<PlayMode>(() => readPlayMode(initialOwnerId))
  const [volume, setVolume] = useState(() => readVolume(initialOwnerId))
  const [isPlaying, setIsPlaying] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [position, setPosition] = useState<DockPosition | null>(null)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [message, setMessage] = useState('請登入後開始建立你的 MP3 歌單。')
  const [cloudSession, setCloudSession] = useState(initialSession)
  const [cloudMusicReady, setCloudMusicReady] = useState(() => !initialSession)
  const currentTrack = tracks[currentIndex]
  const displayTrack = currentTrack ?? defaultTrack

  const makeMusicSettings = (overrides: Partial<CloudMusicSettings> = {}): CloudMusicSettings => ({
    order: tracks.map((track) => track.id),
    names: savedNames.current,
    currentTrackId: currentTrack?.id ?? '',
    playMode,
    volume,
    ...overrides,
  })

  const queueCloudMusicSettings = (overrides: Partial<CloudMusicSettings> = {}) => {
    // Do not let the first render overwrite settings that are still being
    // loaded from the cloud. This used to reset the remote order/volume when
    // a user signed in and the async library load had not finished yet.
    if (cloudSession && !cloudMusicReady) return
    const settings = makeMusicSettings(overrides)
    localStorage.setItem(musicStorageKey(MUSIC_MODE_KEY, cloudSession?.userId), settings.playMode)
    localStorage.setItem(musicStorageKey(MUSIC_TRACK_KEY, cloudSession?.userId), settings.currentTrackId)
    localStorage.setItem(musicStorageKey(MUSIC_VOLUME_KEY, cloudSession?.userId), String(settings.volume))
    localStorage.setItem(musicStorageKey(MUSIC_ORDER_KEY, cloudSession?.userId), JSON.stringify(settings.order))
    localStorage.setItem(musicStorageKey(MUSIC_NAMES_KEY, cloudSession?.userId), JSON.stringify(settings.names))
    if (!cloudSession || !cloudMusicReady) return
    if (settingsTimerRef.current !== null) window.clearTimeout(settingsTimerRef.current)
    settingsTimerRef.current = window.setTimeout(() => {
      settingsTimerRef.current = null
      saveCloudMusicSettings(settings, cloudSession).catch(() => setMessage('本機歌單已保存，但雲端歌單稍後再同步。'))
    }, 600)
  }

  const loadMusicLibrary = async (session: ReturnType<typeof getCloudSession>) => {
    const loadId = ++libraryLoadRef.current
    const ownerId = session?.userId ?? 'anonymous'
    const cloudSettings = readCloudMusicSettings(ownerId)
    if (cloudSettings) {
      savedOrder.current = cloudSettings.order ?? []
      savedNames.current = cloudSettings.names ?? {}
      savedTrackId.current = cloudSettings.currentTrackId || defaultTrack.id
      setPlayMode(cloudSettings.playMode === 'shuffle' ? 'shuffle' : readPlayMode(ownerId))
      setVolume(Number.isFinite(cloudSettings.volume) ? Math.min(1, Math.max(0, cloudSettings.volume)) : 1)
    }
    const storedTracks = await readStoredTracks()
    const storedForOwner = session
      ? storedTracks.filter((track) => track.ownerId === ownerId || (!track.ownerId && isPrimaryMusicAccount(session)))
      : storedTracks.filter((track) => track.ownerId === ownerId || !track.ownerId)
    let remoteTracks: CloudMusicTrack[] = session ? await listCloudMusic(session) : []
    const builtInIds = new Set(builtInTracks.map((track) => track.id))
    savedNames.current = Object.fromEntries(Object.entries(savedNames.current).filter(([id]) => builtInIds.has(id) || remoteTracks.some((track) => track.id === id) || storedForOwner.some((track) => track.id === id)))
    for (const storedTrack of storedForOwner) {
      if (!session || remoteTracks.some((track) => track.id === storedTrack.id)) continue
      try {
        const uploaded = await uploadCloudMusic(new File([storedTrack.blob], `${storedTrack.name}.mp3`, { type: storedTrack.blob.type || 'audio/mpeg' }), storedTrack.name, storedTrack.id, session)
        remoteTracks = [...remoteTracks, uploaded]
        await deleteStoredTrack(storedTrack.id)
      } catch {
        // Keep the local copy if migration cannot reach the cloud.
      }
    }
    const localTracks: MusicTrack[] = storedForOwner.map((track) => {
      const src = URL.createObjectURL(track.blob)
      objectUrlsRef.current.push(src)
      return { id: track.id, name: savedNames.current[track.id] ?? track.name, src, local: true, createdAt: track.createdAt }
    })
    const customTracks: MusicTrack[] = remoteTracks.map((track) => ({ ...track, local: false }))
    const availableTracks = isPrimaryMusicAccount(session) ? [...builtInTracks, ...customTracks, ...localTracks.filter((track) => !customTracks.some((remote) => remote.id === track.id))] : session ? [...customTracks, ...localTracks.filter((track) => !customTracks.some((remote) => remote.id === track.id))] : localTracks
    const orderedTracks = applySavedOrder(availableTracks, readTrackOrder(ownerId))
    savedOrder.current = orderedTracks.map((track) => track.id)
    if (loadId !== libraryLoadRef.current) return
    const allTracks = orderedTracks.map((track) => ({ ...track, name: savedNames.current[track.id] ?? track.name }))
    setTracks(allTracks)
    const savedIndex = allTracks.findIndex((track) => track.id === savedTrackId.current)
    setCurrentIndex(savedIndex >= 0 ? savedIndex : 0)
    setCloudMusicReady(true)
    setMessage(isPrimaryMusicAccount(session) ? `已載入 ${builtInTracks.length} 首帳號內建歌曲，可繼續新增 MP3。` : `${orderedTracks.length} 首歌曲已載入，可繼續新增 MP3。`)
  }

  useEffect(() => {
    loadMusicLibrary(cloudSession).catch(() => setMessage('無法載入播放設定，但仍可播放內建歌曲。'))
    const reload = () => {
      const nextSession = getCloudSession()
      setCloudSession(nextSession)
      setCloudMusicReady(!nextSession)
      loadMusicLibrary(nextSession).catch(() => setMessage('雲端歌單暫時無法讀取。'))
    }
    const unsubscribe = onCloudSessionChange(reload)
    window.addEventListener('cultivation-companion-cloud-ready', reload)
    return () => { libraryLoadRef.current += 1; unsubscribe(); window.removeEventListener('cultivation-companion-cloud-ready', reload) }
  }, [])

  useEffect(() => () => { objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current) }, [])
  useEffect(() => { queueCloudMusicSettings() }, [playMode, currentTrack?.id, volume, tracks, cloudSession, cloudMusicReady])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = soundEnabled ? volume : 0 }, [currentTrack?.id, volume, soundEnabled])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audioRecoveryRef.current = false
    if (!currentTrack) return
    const resolvedSource = new URL(currentTrack.src, window.location.href).href
    if (audio.src !== resolvedSource) {
      audio.src = displayTrack.src
      audio.load()
    }
  }, [currentTrack?.src])

  const playlistCountLabel = useMemo(() => `${tracks.length} 首歌曲`, [tracks.length])

  const playTrackWhenReady = (audio: HTMLAudioElement, background = false) => {
    let started = false
    const stopListening = () => {
      audio.removeEventListener('canplay', startPlayback)
      audio.removeEventListener('loadeddata', startPlayback)
    }
    const startPlayback = () => {
      if (started) return
      started = true
      stopListening()
      audio.play().then(() => {
        started = true
        stopListening()
        setIsPlaying(true)
      }).catch(() => {
        setIsPlaying(false)
        setMessage('手機瀏覽器阻擋自動播放，請先點擊播放鍵一次。')
      })
    }

    // iOS may suspend the page after it is backgrounded and never deliver a
    // canplay callback until the app returns to the foreground. Calling play
    // immediately on the same, user-authorized audio element lets the native
    // media session continue loading the next file in the background.
    if (background) {
      audio.autoplay = true
      // iOS may not have decoded the replacement source when the ended event
      // fires. Keep autoplay enabled and retry as soon as the new source has
      // data; the immediate play call covers browsers that keep decoding in
      // the background.
      audio.addEventListener('canplay', startPlayback, { once: true })
      audio.addEventListener('loadeddata', startPlayback, { once: true })
      audio.play().then(() => {
        setIsPlaying(true)
      }).catch(() => {
        // autoplay remains enabled so iOS can start playback as soon as the
        // source finishes loading; a later visibility change retries it.
        setIsPlaying(false)
      })
      return
    }

    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback()
      return
    }
    audio.addEventListener('canplay', startPlayback, { once: true })
    audio.addEventListener('loadeddata', startPlayback, { once: true })
  }

  const nextTrack = (autoplay: boolean) => {
    if (tracks.length < 2) {
      setIsPlaying(false)
      return
    }
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current)
      nextTimerRef.current = null
    }
    const nextIndex = playMode === 'shuffle'
      ? (() => { const candidates = tracks.map((_, index) => index).filter((index) => index !== currentIndex); return candidates[Math.floor(Math.random() * candidates.length)] })()
      : (currentIndex + 1) % tracks.length

    const audio = audioRef.current
    playbackIntentRef.current = autoplay
    if (audio) {
      // Keep the same audio element so iOS keeps the playback permission granted
      // by the user's first tap. autoplay is only enabled for an actual advance.
      audioRecoveryRef.current = false
      // Do not explicitly pause an already-playing element when advancing in
      // the background. On iOS that extra pause can end the native media
      // session before the replacement source is ready.
      if (!autoplay) audio.pause()
      audio.autoplay = autoplay
      audio.volume = soundEnabled ? volume : 0
      audio.src = tracks[nextIndex].src
      audio.load()
    }
    setCurrentIndex(nextIndex)
    setIsPlaying(autoplay)
    if (autoplay && audio) playTrackWhenReady(audio, document.hidden)
  }

  const previousTrack = () => {
    if (tracks.length < 2) return
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current)
      nextTimerRef.current = null
    }
    if (audioRef.current) {
      playbackIntentRef.current = false
      audioRef.current.pause()
      audioRef.current.autoplay = false
    }
    setCurrentIndex((current) => (current - 1 + tracks.length) % tracks.length)
    setIsPlaying(false)
  }

  const handleTrackEnded = () => {
    if (tracks.length < 2) {
      playbackIntentRef.current = false
      setIsPlaying(false)
      return
    }
    // Keep the intent alive through the ended/pause event so a background
    // transition does not turn automatic playlist playback off.
    playbackIntentRef.current = true
    // Keep the two-second pause while visible. When iOS backgrounds the page,
    // timers may be suspended, so advance from the native ended event instead.
    if (document.hidden) {
      setMessage('歌曲結束，正在背景接續播放下一首。')
      nextTrack(true)
      return
    }
    setMessage('歌曲結束，2 秒後播放下一首。')
    nextTimerRef.current = window.setTimeout(() => {
      nextTimerRef.current = null
      nextTrack(true)
    }, TRACK_GAP_MS)
  }

  useEffect(() => {
    const continueInBackground = () => {
      const audio = audioRef.current
      if (!playbackIntentRef.current) return
      if (document.hidden) {
        // Retry the native media session when the browser changes visibility;
        // this is intentionally not timer-based because iOS suspends timers.
        if (audio && audio.paused && !audio.ended) {
          audio.play().then(() => setIsPlaying(true)).catch(() => undefined)
        }
        return
      }
      if (nextTimerRef.current !== null) {
        window.clearTimeout(nextTimerRef.current)
        nextTimerRef.current = null
        nextTrack(true)
      }
    }
    document.addEventListener('visibilitychange', continueInBackground)
    return () => document.removeEventListener('visibilitychange', continueInBackground)
  }, [currentIndex, playMode, tracks, isPlaying])

  const chooseTrack = (index: number) => {
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current)
      nextTimerRef.current = null
    }
    if (audioRef.current) {
      playbackIntentRef.current = false
      audioRef.current.pause()
      audioRef.current.autoplay = false
    }
    setCurrentIndex(index)
    setIsPlaying(false)
  }

  const reorderTracks = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= tracks.length || toIndex >= tracks.length) return
    const activeId = displayTrack.id
    const nextTracks = [...tracks]
    const [movedTrack] = nextTracks.splice(fromIndex, 1)
    nextTracks.splice(toIndex, 0, movedTrack)
    setTracks(nextTracks)
    setCurrentIndex(nextTracks.findIndex((track) => track.id === activeId))
    localStorage.setItem(musicStorageKey(MUSIC_ORDER_KEY, cloudSession?.userId), JSON.stringify(nextTracks.map((track) => track.id)))
    queueCloudMusicSettings({ order: nextTracks.map((track) => track.id) })
  }

  const startRenaming = (track: MusicTrack) => {
    setEditingTrackId(track.id)
    setEditingName(track.name)
  }

  const saveTrackName = (trackId: string) => {
    const name = editingName.trim().slice(0, 60)
    if (!name) return
    savedNames.current = { ...savedNames.current, [trackId]: name }
    setTracks((current) => current.map((track) => track.id === trackId ? { ...track, name } : track))
    queueCloudMusicSettings({ names: savedNames.current })
    setEditingTrackId(null)
    setMessage('歌曲名稱已更新，音檔內容沒有變更。')
  }

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const ownerId = cloudSession?.userId ?? 'anonymous'
    let added = 0
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') continue
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const name = file.name.replace(/\.mp3$/i, '').trim() || `未命名歌曲 ${added + 1}`
      await saveStoredTrack({ id, name, blob: file, createdAt: Date.now(), ownerId })
      const src = URL.createObjectURL(file)
      objectUrlsRef.current.push(src)
      let track: MusicTrack = { id, name, src, local: true, createdAt: Date.now() }
      if (cloudSession) {
        try {
          const remote = await uploadCloudMusic(file, name, id, cloudSession)
          track = { ...remote, local: true }
        } catch (error) {
          setMessage(error instanceof Error ? `${name} 已保存在本機，但雲端上傳失敗。` : `${name} 已保存在本機。`)
        }
      }
      setTracks((current) => [...current, track])
      added += 1
    }
    if (added) setMessage(cloudSession ? `已加入 ${added} 首 MP3；此帳號的歌單會同步到其他裝置。` : `已加入 ${added} 首 MP3；登入後可同步到其他裝置。`)
    else setMessage('目前只支援 MP3 音檔。')
  }

  const removeTrack = async (track: MusicTrack, index: number) => {
    if (!track.local && builtInTracks.some((candidate) => candidate.id === track.id)) {
      setMessage('帳號內建歌曲無法刪除。')
      return
    }
    if (!window.confirm(`確定要刪除「${track.name}」嗎？`)) return
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current)
      nextTimerRef.current = null
    }
    if (index === currentIndex) {
      playbackIntentRef.current = false
      audioRef.current?.pause()
    }
    try { await deleteStoredTrack(track.id) } catch { /* Cloud copy can still be removed. */ }
    if (cloudSession && !track.id.startsWith('local-')) {
      try { await deleteCloudMusic(track.id, cloudSession) } catch { setMessage('本機歌曲已移除，但雲端刪除失敗，請重新登入後再試。') }
    }
    if (track.src.startsWith('blob:')) {
      URL.revokeObjectURL(track.src)
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== track.src)
    }
    const nextTracks = tracks.filter((candidate) => candidate.id !== track.id)
    const nextIndex = nextTracks.length ? Math.min(index, nextTracks.length - 1) : 0
    setTracks(nextTracks)
    setCurrentIndex(nextIndex)
    savedNames.current = Object.fromEntries(Object.entries(savedNames.current).filter(([id]) => id !== track.id))
    setMessage(`已刪除「${track.name}」。`)
  }

  const clearCustomTracks = async () => {
    const customTracks = tracks.filter((track) => !builtInTracks.some((builtIn) => builtIn.id === track.id))
    if (!customTracks.length) {
      setMessage('目前沒有可清除的自訂歌曲。')
      return
    }
    if (!window.confirm(`確定要刪除目前 ${customTracks.length} 首自訂歌曲嗎？40 首內建歌曲會保留，刪除後無法復原。`)) return
    playbackIntentRef.current = false
    audioRef.current?.pause()
    const failed: string[] = []
    for (const track of customTracks) {
      try {
        await deleteStoredTrack(track.id)
        if (cloudSession) await deleteCloudMusic(track.id, cloudSession)
        if (track.src.startsWith('blob:')) URL.revokeObjectURL(track.src)
      } catch {
        failed.push(track.name)
      }
    }
    const remaining = tracks.filter((track) => !customTracks.includes(track) || failed.includes(track.name))
    setTracks(remaining)
    setCurrentIndex(Math.min(currentIndex, Math.max(remaining.length - 1, 0)))
    if (failed.length) setMessage(`已刪除 ${customTracks.length - failed.length} 首，${failed.length} 首刪除失敗，請重新登入後再試。`)
    else setMessage(`已清除 ${customTracks.length} 首自訂歌曲，40 首內建歌曲已保留。`)
  }

  const handleVolumeChange = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    // While muted, keep the user's preferred volume so turning sound back on
    // restores it instead of saving the temporary zero volume.
    if (soundEnabled) setVolume(event.currentTarget.volume)
  }
  const handleAudioError = () => {
    const audio = audioRef.current
    if (audio && !audioRecoveryRef.current) {
      audioRecoveryRef.current = true
      audio.src = displayTrack.src
      audio.load()
      setMessage('正在重新載入音樂…')
      if (playbackIntentRef.current) playTrackWhenReady(audio, document.hidden)
      return
    }
    setIsPlaying(false)
    setMessage('這首 MP3 目前無法播放，請再次點擊播放鍵。')
  }

  const handlePlaylistPointerDown = (index: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input')) return
    if (event.pointerType === 'touch') {
      playlistDragIndexRef.current = null
      return
    }
    playlistDragIndexRef.current = index
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePlaylistPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const fromIndex = playlistDragIndexRef.current
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-playlist-index]')
    const toIndex = target ? Number(target.dataset.playlistIndex) : -1
    if (fromIndex === null || toIndex < 0 || fromIndex === toIndex) return
    reorderTracks(fromIndex, toIndex)
    playlistDragIndexRef.current = toIndex
  }

  const stopPlaylistDragging = () => { playlistDragIndexRef.current = null }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, audio, label')) return
    const card = event.currentTarget.closest('.music-player-dock') as HTMLElement | null
    if (!card) return
    const rect = card.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const card = event.currentTarget.closest('.music-player-dock') as HTMLElement | null
    if (!card) return
    const maxLeft = Math.max(8, window.innerWidth - card.offsetWidth - 8)
    const maxTop = Math.max(8, window.innerHeight - card.offsetHeight - 8)
    setPosition({ left: Math.min(Math.max(8, event.clientX - dragRef.current.offsetX), maxLeft), top: Math.min(Math.max(8, event.clientY - dragRef.current.offsetY), maxTop) })
  }

  const stopDragging = () => { dragRef.current = null }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const mediaSession = navigator.mediaSession
    if (!currentTrack) return
    mediaSession.metadata = new MediaMetadata({ title: currentTrack.name, artist: '修仙伴讀', album: '靜心音律' })
    const play = () => {
      playbackIntentRef.current = true
      audioRef.current?.play().catch(() => setMessage('請點擊播放鍵，瀏覽器不允許自動播放聲音。'))
    }
    const pause = () => {
      playbackIntentRef.current = false
      audioRef.current?.pause()
    }
    const seekBy = (seconds: number) => {
      if (!audioRef.current) return
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || Number.MAX_SAFE_INTEGER, audioRef.current.currentTime + seconds))
    }
    try {
      mediaSession.setActionHandler('play', play)
      mediaSession.setActionHandler('pause', pause)
      mediaSession.setActionHandler('nexttrack', () => nextTrack(true))
      mediaSession.setActionHandler('previoustrack', previousTrack)
      mediaSession.setActionHandler('seekbackward', () => seekBy(-10))
      mediaSession.setActionHandler('seekforward', () => seekBy(10))
    } catch {
      // iOS/Safari may expose only a subset of Media Session actions.
    }
    return () => {
      mediaSession.metadata = null
      try {
        mediaSession.setActionHandler('play', null)
        mediaSession.setActionHandler('pause', null)
        mediaSession.setActionHandler('nexttrack', null)
        mediaSession.setActionHandler('previoustrack', null)
        mediaSession.setActionHandler('seekbackward', null)
        mediaSession.setActionHandler('seekforward', null)
      } catch {
        // Ignore unsupported cleanup actions.
      }
    }
  }, [currentTrack?.id, currentTrack?.name, playMode, tracks.length, currentIndex, soundEnabled])

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  return <section className="card music-player-card music-player-dock" style={position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } : undefined} aria-label="本機背景音樂播放器">
    <div className="music-dock-header music-drag-handle" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging}>
      <div className="music-track-info"><span className="music-track-icon">{isPlaying ? '♫' : '♪'}</span><div><strong>{currentTrack?.name ?? '尚未加入歌曲'}</strong><small>修仙伴讀背景音樂 · {playlistCountLabel}</small></div></div>
      <button type="button" className="text-button music-playlist-toggle" onClick={() => setShowPlaylist((current) => !current)}>{showPlaylist ? '收起歌單' : '查看歌單'}</button>
    </div>
    {currentTrack ? <audio ref={audioRef} className="music-audio" src={currentTrack.src} controls preload="auto" playsInline aria-label={`播放 ${currentTrack.name}`} onPlay={() => { audioRecoveryRef.current = false; playbackIntentRef.current = true; if (audioRef.current) audioRef.current.autoplay = true; setIsPlaying(true) }} onPause={() => { const audio = audioRef.current; if (audio?.ended) return; setIsPlaying(false); window.setTimeout(() => { if (!audio || audio !== audioRef.current || audio.ended) return; if (document.hidden && playbackIntentRef.current) { audio.play().then(() => setIsPlaying(true)).catch(() => undefined); return } if (!document.hidden) playbackIntentRef.current = false }, 0) }} onVolumeChange={handleVolumeChange} onEnded={handleTrackEnded} onError={handleAudioError} /> : <div className="music-empty"><span>♫</span><p>目前沒有歌曲<br /><small>選擇 MP3 後即可建立自己的歌單。</small></p></div>}
    <div className="music-actions">
      <button type="button" className="soft-button" onClick={previousTrack} disabled={tracks.length < 2}>上一首</button>
      <button type="button" className="soft-button" onClick={() => nextTrack(false)} disabled={tracks.length < 2}>下一首</button>
      <label className="soft-button music-file-button">加入 MP3<input type="file" accept="audio/mpeg,.mp3" multiple onChange={(event) => void handleFileSelection(event)} /></label>
      {isPrimaryMusicAccount(cloudSession) && tracks.some((track) => !builtInTracks.some((builtIn) => builtIn.id === track.id)) && <button type="button" className="text-button" onClick={() => void clearCustomTracks()}>清除自訂歌曲</button>}
      <select className="music-mode-select" value={playMode} onChange={(event) => setPlayMode(event.target.value as PlayMode)} aria-label="播放模式"><option value="sequential">依序播放</option><option value="shuffle">隨機播放</option></select>
    </div>
    {showPlaylist && <div className="music-playlist">{tracks.map((track, index) => <div className={`music-playlist-item ${index === currentIndex ? 'active' : ''}`} data-playlist-index={index} key={track.id} onPointerDown={(event) => handlePlaylistPointerDown(index, event)} onPointerMove={handlePlaylistPointerMove} onPointerUp={stopPlaylistDragging} onPointerCancel={stopPlaylistDragging}><span>{index + 1}</span>{editingTrackId === track.id ? <input className="music-rename-input" value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveTrackName(track.id); if (event.key === 'Escape') setEditingTrackId(null) }} autoFocus /> : <button type="button" className="music-track-select" onClick={() => chooseTrack(index)}>{track.name}</button>}{editingTrackId === track.id ? <button type="button" className="music-rename-save" onClick={() => saveTrackName(track.id)}>保存</button> : <button type="button" className="music-rename-button" onClick={() => startRenaming(track)}>改名</button>}{track.local || !builtInTracks.some((candidate) => candidate.id === track.id) ? <button type="button" className="music-delete-button" onClick={() => void removeTrack(track, index)} aria-label={`刪除 ${track.name}`} title="刪除歌曲">刪除</button> : null}</div>)}</div>}
    <div className="music-footer"><span>{message}</span><span>{playMode === 'shuffle' ? '隨機播放' : '依序播放'} · 間隔 2 秒</span></div>
  </section>
}
