import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getSubjectReward } from '../data'
import type { StudySubject } from '../types'

interface StudyTimerProps {
  subject: string
  subjectCatalog: StudySubject[]
  onSubjectChange: (subject: string) => void
  onComplete: (minutes: number, subject: string) => void
  onCancel?: () => void
  compact?: boolean
}

const focusOptions = [25, 45, 60]

export function StudyTimer({ subject, subjectCatalog, onSubjectChange, onComplete, onCancel, compact = false }: StudyTimerProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    if (endAtRef.current === null) endAtRef.current = Date.now() + secondsLeft * 1000
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(((endAtRef.current ?? Date.now()) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        endAtRef.current = null
        setRunning(false)
        onComplete(selectedMinutes, subject)
      }
    }
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [running, selectedMinutes, subject, onComplete])

  const displayTime = useMemo(() => `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`, [secondsLeft])
  const progress = 100 - (secondsLeft / (selectedMinutes * 60)) * 100
  const subjectMeta = useMemo(() => subjectCatalog.find((item) => item.name === subject), [subject, subjectCatalog])
  const rewardPreview = getSubjectReward(subjectMeta, selectedMinutes)

  const chooseDuration = (minutes: number) => {
    endAtRef.current = null
    setSelectedMinutes(minutes)
    setSecondsLeft(minutes * 60)
    setRunning(false)
  }

  const reset = () => {
    endAtRef.current = null
    setSecondsLeft(selectedMinutes * 60)
    setRunning(false)
  }

  const toggleRunning = () => {
    if (!running) {
      endAtRef.current = null
      setRunning(true)
      return
    }
    const remaining = Math.max(0, Math.ceil(((endAtRef.current ?? Date.now()) - Date.now()) / 1000))
    endAtRef.current = null
    setSecondsLeft(remaining)
    setRunning(false)
  }

  return <div className={`timer-card ${compact ? 'compact' : ''}`}>
    <div className="timer-topline"><span className="eyebrow">靜心入定</span><span className="timer-status"><i className={running ? 'status-live' : ''} />{running ? '修煉中' : '準備開始'}</span></div>
    <div className="timer-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><div className="timer-inner"><span className="timer-time">{displayTime}</span><span className="timer-caption">專注時辰</span></div></div>
    <div className="subject-select"><label htmlFor="subject">本次修煉科目</label><select id="subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)} disabled={running}>{subjectCatalog.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><div className="subject-reward"><span>{subjectMeta?.difficulty ?? '入門'} · {subjectMeta?.quality ?? '普通'}</span><strong>預計 +{rewardPreview.exp} 修為 · +{rewardPreview.stones} 靈石</strong></div></div>
    <div className="duration-row">{focusOptions.map((minutes) => <button key={minutes} className={selectedMinutes === minutes ? 'selected' : ''} onClick={() => chooseDuration(minutes)} disabled={running}>{minutes} 分鐘</button>)}</div>
    <div className="timer-controls"><button className="primary-button timer-button" onClick={toggleRunning}>{running ? '暫停修煉' : secondsLeft < selectedMinutes * 60 ? '繼續修煉' : '開始修煉'} <span>{running ? 'Ⅱ' : '▶'}</span></button>{secondsLeft < selectedMinutes * 60 && <button className="reset-button" onClick={reset}>重設</button>}{onCancel && <button className="reset-button" onClick={onCancel}>關閉</button>}</div>
    <p className="timer-tip">完成專注後，可獲得修為經驗與靈石獎勵。</p>
  </div>
}
