import type { FruitGarden } from '../types'

export function FruitGardenCard({ garden, onHarvest }: { garden: FruitGarden; onHarvest: (fruitId: string) => void }) {
  return <section className="card fruit-card">
    <div className="card-heading"><div><span className="eyebrow">靈植園</span><h2>讀書種靈果</h2></div><span className="fruit-icon">✿</span></div>
    <div className="fruit-list">{garden.fruits.map((fruit) => { const progress = Math.min(fruit.progressMinutes / fruit.targetMinutes * 100, 100); return <div className="fruit-row" key={fruit.id}><div className="fruit-row-icon" style={{ color: fruit.color }}>{fruit.icon}</div><div className="fruit-row-main"><div className="fruit-row-title"><strong>{fruit.name}</strong></div><div className="fruit-track"><span style={{ width: `${progress}%`, background: fruit.color }} /></div><div className="fruit-row-meta"><span>{fruit.progressMinutes} / {fruit.targetMinutes} 分鐘 · 已採收 {fruit.totalHarvested}</span>{fruit.readyCount > 0 && <button className="soft-button" onClick={() => onHarvest(fruit.id)}>採收 {fruit.readyCount}</button>}</div></div></div> })}</div>
    <p className="fruit-tip">讀哪一科，就培育該科目對應的靈果；專注時間越長，成長越快。</p>
  </section>
}
