import type { CollectionItem, FruitGarden, MaterialStock } from '../types'

interface InventoryPanelProps {
  materials: MaterialStock[]
  fruitGarden: FruitGarden
  collectionItems: CollectionItem[]
}

export function InventoryPanel({ materials, fruitGarden, collectionItems }: InventoryPanelProps) {
  const readyFruits = fruitGarden.fruits.filter((fruit) => fruit.readyCount > 0)
  return <section className="card inventory-card">
    <div className="card-heading"><div><span className="eyebrow">隨身背包</span><h2>修行資源</h2></div><span className="inventory-count">{materials.length + readyFruits.length + collectionItems.length} 類</span></div>
    <div className="inventory-section"><strong>探索材料</strong>{materials.length === 0 ? <small className="inventory-empty">完成大世界探索後會收進這裡。</small> : <div className="inventory-items">{materials.map((item) => <span key={item.name}>{item.icon} {item.name} <b>×{item.amount}</b></span>)}</div>}</div>
    <div className="inventory-section"><strong>成熟靈果</strong>{readyFruits.length === 0 ? <small className="inventory-empty">目前沒有可使用的成熟靈果。</small> : <div className="inventory-items">{readyFruits.map((fruit) => <span key={fruit.id}>{fruit.icon} {fruit.name} <b>×{fruit.readyCount}</b></span>)}</div>}</div>
    <div className="inventory-section"><strong>奇珍圖鑑</strong>{collectionItems.length === 0 ? <small className="inventory-empty">探索發現的物品會在這裡留下紀錄。</small> : <div className="inventory-items">{collectionItems.map((item) => <span key={item.id}>{item.icon} {item.name} <b>×{item.quantity}</b></span>)}</div>}</div>
  </section>
}
