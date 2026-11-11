import { useEffect, useMemo, useRef, useState } from 'react'

const activities = [
  { name: '晨間散步', icon: '☼', detail: '走出洞府，讓身心換氣' },
  { name: '戶外運動', icon: 'ϟ', detail: '活動筋骨，尋找靈氣足跡' },
  { name: '休閒娛樂', icon: '♫', detail: '放鬆心神，偶遇奇珍' },
]

export function WorldExploreCard({ onExplore, totalMinutes = 0 }: { onExplore: (activity: string, minutes: number) => void; totalMinutes?: number }) {
  const [selected, setSelected] = useState(0)
  const [selectedMinutes, setSelectedMinutes] = useState(15)
  const [secondsLeft, setSecondsLeft] = useState(15 * 60)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef<number | null>(null)
  const activity = activities[selected]
  useEffect(() => {
    if (!running) return
    if (endAtRef.current === null) endAtRef.current = Date.now() + secondsLeft * 1000
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(((endAtRef.current ?? Date.now()) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        endAtRef.current = null
        setRunning(false)
        onExplore(activity.name, selectedMinutes)
      }
    }
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [running, activity.name, selectedMinutes, onExplore])
  const displayTime = useMemo(() => `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`, [secondsLeft])
  const chooseDuration = (minutes: number) => { if (running) return; endAtRef.current = null; setSelectedMinutes(minutes); setSecondsLeft(minutes * 60) }
  const toggleExplore = () => { if (running) { endAtRef.current = null; setRunning(false); setSecondsLeft(selectedMinutes * 60); return } endAtRef.current = null; setSecondsLeft(selectedMinutes * 60); setRunning(true) }
  return <section className="card explore-card">
    <div className="card-heading"><div><span className="eyebrow">大世界</span><h2>出門探險</h2></div><span className="explore-compass">✧</span></div>
    <div className="explore-scene"><span className="mountain mountain-back" /><span className="mountain mountain-front" /><span className="explore-cloud">☁</span><span className="explore-character">🐷</span></div>
    <p>{activity.detail}，完成探索時長後才會發放稀有圖鑑物品與靈石。</p>
    <div className="activity-tabs">{activities.map((item, index) => <button key={item.name} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)} disabled={running}><span>{item.icon}</span>{item.name}</button>)}</div>
    <div className="explore-duration"><span>探索時長</span>{[15, 30, 60].map((minutes) => <button key={minutes} className={selectedMinutes === minutes ? 'active' : ''} onClick={() => chooseDuration(minutes)} disabled={running}>{minutes} 分</button>)}</div>
    <div className="explore-timer-line"><span>{running ? `探索中 ${displayTime}` : `累積探索 ${totalMinutes} 分鐘`}</span><button className="soft-button explore-button" onClick={toggleExplore}>{running ? '中止探索' : `開始${activity.name}`} <span>{running ? 'Ⅱ' : '→'}</span></button></div>
  </section>
}
