import type { GameState } from '../types'

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function getStudyDays(sessions: GameState['sessions']) {
  return new Set(sessions.map((session) => dateKey(new Date(session.completedAt))))
}

function getCurrentStreak(sessions: GameState['sessions']) {
  const days = getStudyDays(sessions)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function StatisticsPanel({ game }: { game: GameState }) {
  const studyMinutes = game.sessions.reduce((sum, session) => sum + session.minutes, 0)
  const explorationMinutes = game.explorationSessions.reduce((sum, session) => sum + session.minutes, 0)
  const harvested = game.fruitGarden.fruits.reduce((sum, fruit) => sum + fruit.totalHarvested, 0)
  const materials = game.materials.reduce((sum, material) => sum + material.amount, 0)
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - 6)
  const weekMinutes = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    const key = dateKey(day)
    return game.sessions.filter((session) => dateKey(new Date(session.completedAt)) === key).reduce((sum, session) => sum + session.minutes, 0)
  })
  const maxWeekMinutes = Math.max(...weekMinutes, 1)
  const monthMinutes = game.sessions.filter((session) => {
    const date = new Date(session.completedAt)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).reduce((sum, session) => sum + session.minutes, 0)
  const subjectMinutes = Object.entries(game.sessions.reduce<Record<string, number>>((totals, session) => { totals[session.subject] = (totals[session.subject] ?? 0) + session.minutes; return totals }, {})).sort(([, a], [, b]) => b - a).slice(0, 5)
  const maxSubjectMinutes = Math.max(subjectMinutes[0]?.[1] ?? 1, 1)
  const rows = [['專注讀書', `${studyMinutes} 分鐘`], ['本月專注', `${monthMinutes} 分鐘`], ['探索時間', `${explorationMinutes} 分鐘`], ['完成讀書次數', `${game.sessions.length} 次`], ['採收靈果', `${harvested} 枚`], ['探索奇珍', `${game.collectionItems.length} 種`], ['背包材料', `${materials} 件`], ['餵食靈寵', `${game.lifetimeStats.feedCount} 次`], ['完成煉製', `${game.lifetimeStats.craftCount} 次`], ['收藏家具', `${game.lifetimeStats.furnitureCount} 件`], ['已突破境界', `${game.breakthroughs.length} 次`]]
  return <section className="card statistics-card">
    <div className="card-heading"><div><span className="eyebrow">修行紀錄</span><h2>統計總覽</h2></div><span className="statistics-mark">✧</span></div>
    <div className="statistics-highlight"><div><small>目前連續修煉</small><strong>{getCurrentStreak(game.sessions)} 日</strong></div><div><small>近 7 日專注</small><strong>{weekMinutes.reduce((sum, minutes) => sum + minutes, 0)} 分</strong></div><div><small>本月專注</small><strong>{monthMinutes} 分</strong></div></div>
    <div className="statistics-week"><div className="statistics-subheading"><span>近 7 日專注</span><small>每日實際紀錄</small></div><div className="statistics-bars">{weekMinutes.map((minutes, index) => { const day = new Date(weekStart); day.setDate(weekStart.getDate() + index); return <div className="statistics-bar" key={dateKey(day)} title={`${dateKey(day)}：${minutes} 分鐘`}><span style={{ height: `${minutes ? Math.max(8, minutes / maxWeekMinutes * 100) : 0}%` }} /><small>{['日', '一', '二', '三', '四', '五', '六'][day.getDay()]}</small></div> })}</div></div>
    <div className="subject-breakdown"><div className="statistics-subheading"><span>科目專注排行</span><small>前 5 名</small></div>{subjectMinutes.length === 0 ? <p className="statistics-empty">完成一次讀書後，這裡會顯示科目分析。</p> : subjectMinutes.map(([subject, minutes]) => <div className="subject-stat" key={subject}><div><strong>{subject}</strong><small>{minutes} 分鐘</small></div><div className="subject-track"><span style={{ width: `${minutes / maxSubjectMinutes * 100}%` }} /></div></div>)}</div>
    <div className="statistics-grid">{rows.map(([label, value]) => <div className="statistics-item" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <div className="statistics-footer"><span>目前修為</span><b>{game.cultivationExp.toLocaleString()} 點</b><span>靈石</span><b>{game.spiritStones.toLocaleString()}</b></div>
  </section>
}
