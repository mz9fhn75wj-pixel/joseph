import type { CaveFurniture } from '../types'

interface CaveFurniturePanelProps {
  furniture: CaveFurniture[]
  spiritStones: number
  onBuy: (id: string) => void
  onTogglePlacement: (id: string) => void
}

export function CaveFurniturePanel({ furniture, spiritStones, onBuy, onTogglePlacement }: CaveFurniturePanelProps) {
  const placedCount = furniture.filter((item) => item.placed).length
  return <section className="card furniture-card">
    <div className="card-heading"><div><span className="eyebrow">洞府佈置</span><h2>家具與靈氣</h2></div><span className="furniture-count">已擺放 {placedCount} 件</span></div>
    <p className="phase3-intro">用靈石收藏家具，擺入洞府後留下你的修煉風格。</p>
    <div className="furniture-grid">{furniture.map((item) => <div className={`furniture-item ${item.placed ? 'placed' : ''}`} key={item.id}>
      <span className="furniture-icon">{item.icon}</span><div className="furniture-copy"><strong>{item.name}</strong><small>{item.description}</small><em>{item.owned > 0 ? `持有 ${item.owned} 件` : `${item.cost} 靈石`}</em></div>
      {item.owned === 0 ? <button className="soft-button" onClick={() => onBuy(item.id)} disabled={spiritStones < item.cost}>購買</button> : <button className="soft-button" onClick={() => onTogglePlacement(item.id)}>{item.placed ? '收起' : '擺放'}</button>}
    </div>)}</div>
  </section>
}
