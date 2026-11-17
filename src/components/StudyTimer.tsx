import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { StudySubject } from '../types'

export const STUDY_TIMER_STORAGE_KEY = 'cultivation-companion-active-study-timer-v1'

export interface StudyTimerSnapshot {
  subject: string
  elapsedSeconds: number
  started: boolean
  savedAt: number
}

export function readStudyTimerSnapshot(): StudyTimerSnapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(STUDY_TIMER_STORAGE_KEY) ?? 'null') as Partial<StudyTimerSnapshot> | null
    if (!value || typeof value.subject !== 'string' || !value.started || typeof value.elapsedSeconds !== 'number' || !Number.isFinite(value.elapsedSeconds)) return null
    return { subject: value.subject, elapsedSeconds: Math.max(0, Math.floor(value.elapsedSeconds)), started: true, savedAt: Number(value.savedAt) || Date.now() }
  } catch {
    return null
  }
}

export function clearStudyTimerSnapshot() {
  localStorage.removeItem(STUDY_TIMER_STORAGE_KEY)
}

interface StudyTimerProps {
  subject: string
  subjectCatalog: StudySubject[]
  onSubjectChange: (subject: string) => void
  onComplete: (minutes: number, subject: string) => void
  onCancel?: () => void
  compact?: boolean
  initialSnapshot?: StudyTimerSnapshot | null
}

export function StudyTimer({ subject, subjectCatalog, onSubjectChange, onComplete, onCancel, compact = false, initialSnapshot }: StudyTimerProps) {
  const restored = initialSnapshot?.started ? initialSnapshot : null
  const [elapsedSeconds, setElapsedSeconds] = useState(restored?.elapsedSeconds ?? 0)
  const [started, setStarted] = useState(Boolean(restored))
  const [running, setRunning] = useState(false)
  const elapsedRef = useRef(restored?.elapsedSeconds ?? 0)
  const startedRef = useRef(Boolean(restored))
  const runningRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const subjectRef = useRef(restored?.subject || subject)

  const currentElapsed = () => {
    const startedAt = startedAtRef.current
    if (!runningRef.current || startedAt === null) return elapsedRef.current
    return elapsedRef.current + Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  }

  const persist = (seconds = currentElapsed()) => {
    const snapshot: StudyTimerSnapshot = { subject: subjectRef.current, elapsedSeconds: Math.max(0, Math.floor(seconds)), started: startedRef.current, savedAt: Date.now() }
    if (snapshot.started) localStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(snapshot))
    else clearStudyTimerSnapshot()
  }

  const pause = () => {
    const seconds = currentElapsed()
    elapsedRef.current = seconds
    setElapsedSeconds(seconds)
    startedAtRef.current = null
    runningRef.current = false
    setRunning(false)
    persist(seconds)
  }

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const seconds = currentElapsed()
      if (seconds === elapsedRef.current) return
      elapsedRef.current = seconds
      startedAtRef.current = Date.now()
      setElapsedSeconds(seconds)
      persist(seconds)
    }
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    const pauseBeforeLeaving = () => { if (runningRef.current) pause() }
    window.addEventListener('pagehide', pauseBeforeLeaving)
    return () => {
      window.removeEventListener('pagehide', pauseBeforeLeaving)
      if (runningRef.current) pause()
      else if (startedRef.current) persist()
    }
  }, [])

  useEffect(() => {
    if (!startedRef.current) subjectRef.current = subject
  }, [subject])

  const displayTime = useMemo(() => `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`, [elapsedSeconds])
  const progress = Math.min((elapsedSeconds / (60 * 60)) * 100, 100)
  const subjectMeta = useMemo(() => subjectCatalog.find((item) => item.name === (started ? subjectRef.current : subject)), [subject, subjectCatalog, started])

  const reset = () => {
    startedAtRef.current = null
    elapsedRef.current = 0
    startedRef.current = false
    runningRef.current = false
    setElapsedSeconds(0)
    setStarted(false)
    setRunning(false)
    clearStudyTimerSnapshot()
  }

  const toggleRunning = () => {
    if (runningRef.current) {
      pause()
      return
    }
    subjectRef.current = subject
    startedRef.current = true
    runningRef.current = true
    startedAtRef.current = Date.now()
    setStarted(true)
    setRunning(true)
    persist(elapsedRef.current)
  }

  const settle = () => {
    const seconds = currentElapsed()
    const minutes = Math.floor(seconds / 60)
    if (minutes < 1) return
    elapsedRef.current = seconds
    startedAtRef.current = null
    runningRef.current = false
    startedRef.current = false
    setElapsedSeconds(seconds)
    setRunning(false)
    setStarted(false)
    clearStudyTimerSnapshot()
    onComplete(minutes, subjectRef.current)
  }

  const close = () => {
    if (runningRef.current) pause()
    else if (startedRef.current) persist()
    onCancel?.()
  }

  return <div className={`timer-card ${compact ? 'compact' : ''}`}>
    <div className="timer-topline"><span className="eyebrow">靜心入定</span><span className="timer-status"><i className={running ? 'status-live' : ''} />{running ? '修煉中' : started ? '已暫停' : '準備開始'}</span></div>
    <div className="timer-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><div className="timer-inner"><span className="timer-time">{displayTime}</span><span className="timer-caption">專注時辰</span></div></div>
    <div className="subject-select"><label htmlFor="subject">本次修煉科目</label><select id="subject" value={started ? subjectRef.current : subject} onChange={(event) => { subjectRef.current = event.target.value; onSubjectChange(event.target.value) }} disabled={started}>{subjectCatalog.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><div className="subject-reward"><span>{subjectMeta?.difficulty ?? '入門'} · {subjectMeta?.quality ?? '普通'}</span><strong>結算時依實際讀書分鐘計算獎勵</strong></div></div>
    <div className="timer-controls"><button className="primary-button timer-button" onClick={toggleRunning}>{running ? '暫停修煉' : started ? '繼續修煉' : '開始修煉'} <span>{running ? 'Ⅱ' : '▶'}</span></button>{started && <><button className="primary-button timer-button" onClick={settle} disabled={Math.floor(currentElapsed() / 60) < 1}>結算修煉 <span>✓</span></button><button className="reset-button" onClick={reset}>重設</button></>}{onCancel && <button className="reset-button" onClick={close}>關閉</button>}</div>
    <p className="timer-tip">開始後從 0:00 累積；可隨時暫停，結算後會依實際分鐘給予修為、靈石與靈果。</p>
  </div>
}
