import type { CSSProperties } from 'react'
import type { PetState, StudySession } from '../types'
import { localDateKey } from '../utils/date'

export function ProgressCard({ sessions, dailyGoal, pet }: { sessions: StudySession[]; dailyGoal: number; pet: PetState }) {
  const today = localDateKey()
  const todayMinutes = sessions.filter((session) => localDateKey(new Date(session.completedAt)) === today).reduce((sum, session) => sum + session.minutes, 0)
  const progress = Math.min(todayMinutes / dailyGoal * 100, 100)
  return <section className="card progress-card">
    <div className="card-heading"><div><span className="eyebrow">今日修行</span><h2>專注，靈氣自來</h2></div><span className="date-label">{new Intl.DateTimeFormat('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date())}</span></div>
    <div className="daily-progress"><div className="progress-number"><strong>{todayMinutes}</strong><span>/ {dailyGoal} 分鐘</span></div><div className="progress-ring-small" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><span>{Math.round(progress)}%</span></div></div>
    <div className="daily-track"><span style={{ width: `${progress}%` }} /></div>
    <div className="goal-note"><span className="goal-icon">✦</span><span>再專注 <strong>{Math.max(dailyGoal - todayMinutes, 0)} 分鐘</strong>，噗比就能吸收更多靈氣！</span></div>
    <div className="quick-stats"><div><span>今日修為</span><strong>+{todayMinutes * 10}</strong></div><div><span>靈石獲得</span><strong>+{todayMinutes * 2}</strong></div><div><span>靈獸親密</span><strong>+{Math.min(todayMinutes, 10)}</strong></div></div>
    <div className="pet-micro-line"><span className="mini-pet">🐷</span><span>{pet.name} 正在洞府裡為你守護心神</span></div>
  </section>
}
