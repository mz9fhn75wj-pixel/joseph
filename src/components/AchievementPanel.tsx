import { achievementCatalog } from '../data'
import type { AchievementProgress } from '../types'

export function AchievementPanel({ achievements, onClaim }: { achievements: AchievementProgress[]; onClaim: (id: string) => void }) {
  const completed = achievements.filter((item) => item.claimed).length
  return <section className="card achievement-card">
    <div className="card-heading"><div><span className="eyebrow">修行里程碑</span><h2>成就</h2></div><span className="achievement-count">{completed} / {achievementCatalog.length}</span></div>
    <div className="achievement-list">{achievementCatalog.map((definition) => { const state = achievements.find((item) => item.id === definition.id) ?? { id: definition.id, progress: 0, claimed: false }; const progress = Math.min(state.progress, definition.target); const ready = progress >= definition.target; return <div className={`achievement-item ${state.claimed ? 'claimed' : ''}`} key={definition.id}><span className="achievement-icon">{state.claimed ? '✓' : definition.icon}</span><div className="achievement-copy"><strong>{definition.title}</strong><small>{definition.description}</small><div className="achievement-track"><span style={{ width: `${progress / definition.target * 100}%` }} /></div><em>{progress.toLocaleString()} / {definition.target.toLocaleString()} · +{definition.rewardStones} 靈石</em></div><button className="soft-button" disabled={!ready || state.claimed} onClick={() => onClaim(definition.id)}>{state.claimed ? '已領取' : ready ? '領取' : '進行中'}</button></div> })}</div>
  </section>
}
