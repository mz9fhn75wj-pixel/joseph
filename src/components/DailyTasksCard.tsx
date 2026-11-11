import type { DailyTask } from '../types'

export function DailyTasksCard({ tasks, onClaim }: { tasks: DailyTask[]; onClaim: (id: string) => void }) {
  return <section className="card daily-tasks-card">
    <div className="card-heading"><div><span className="eyebrow">每日修行</span><h2>今日任務</h2></div><span className="task-count">{tasks.filter((task) => task.claimed).length} / {tasks.length}</span></div>
    <div className="daily-task-list">{tasks.map((task) => { const progress = Math.min(task.progress / task.target * 100, 100); const completed = task.progress >= task.target; return <div className={`daily-task ${task.claimed ? 'claimed' : ''}`} key={task.id}><span className="daily-task-icon">{task.claimed ? '✓' : completed ? '✦' : '·'}</span><div className="daily-task-copy"><strong>{task.title}</strong><small>{task.description}</small><div className="daily-task-track"><span style={{ width: `${progress}%` }} /></div><em>{Math.min(task.progress, task.target)} / {task.target}</em></div><button className="daily-task-reward" disabled={!completed || task.claimed} onClick={() => onClaim(task.id)}>{task.claimed ? '已領取' : completed ? '領取' : `+${task.rewardStones} 石`}</button></div> })}</div>
  </section>
}
