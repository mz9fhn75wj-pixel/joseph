import { useState } from 'react'
import { getPetMood, petMoods } from '../data'
import type { FruitGarden, PetState } from '../types'
import { PigIllustration } from './PigIllustration'

interface PetCardProps {
  pet: PetState
  realmName: string
  garden: FruitGarden
  onFeed: (fruitId: string) => void
  onPlay: () => void
  interactionAvailable: boolean
  interactionLabel: string
}

function StatBar({ label, value, icon, tone }: { label: string; value: number; icon: string; tone: string }) {
  return <div className="pet-stat-row">
    <span className="stat-label"><span>{icon}</span>{label}</span>
    <div className="stat-track"><span className={`stat-fill ${tone}`} style={{ width: `${value}%` }} /></div>
    <span className="stat-value">{value}</span>
  </div>
}

export function PetCard({ pet, realmName, garden, onFeed, onPlay, interactionAvailable, interactionLabel }: PetCardProps) {
  const [feedFruitId, setFeedFruitId] = useState(garden.fruits[0]?.id ?? '')
  const mood = petMoods[getPetMood(pet.mood, pet.energy)]

  return <section className="card pet-card">
    <div className="card-heading">
      <div><span className="eyebrow">靈獸狀態</span><h2>{pet.name}</h2><span className="realm-badge">✦ {realmName}</span></div>
      <button className="more-button" aria-label="更多寵物選項">···</button>
    </div>
    <div className="pet-stage">
      <div className="cloud cloud-one" /><div className="cloud cloud-two" />
      <div className="pet-aura">✦</div>
      <PigIllustration />
      <div className="pet-sparkle sparkle-one">✦</div><div className="pet-sparkle sparkle-two">✧</div>
      <div className="mood-bubble"><span>{mood.icon}</span>{mood.label}</div>
    </div>
    <div className="pet-info-row"><span>小豬 · 靈獸</span><span className="exp-label">境界與戰鬥屬性</span></div>
    <div className="pet-stats">
      <StatBar label="飽食" value={pet.hunger} icon="◒" tone="mint" />
      <StatBar label="心情" value={pet.mood} icon="♡" tone="peach" />
      <StatBar label="精力" value={pet.energy} icon="ϟ" tone="lavender" />
      <StatBar label="親密" value={pet.intimacy} icon="♧" tone="gold" />
    </div>
    <div className="combat-stats"><span>戰鬥屬性</span><b>⚔ {pet.combatStats.attack}<small>攻擊</small></b><b>🛡 {pet.combatStats.defense}<small>防禦</small></b><b>✦ {pet.combatStats.spirit}<small>靈力</small></b><b>➹ {pet.combatStats.agility}<small>敏捷</small></b></div>
    <div className="pet-actions"><div className="feed-action"><select value={feedFruitId} onChange={(event) => setFeedFruitId(event.target.value)} aria-label="選擇餵食靈果">{garden.fruits.map((fruit) => <option key={fruit.id} value={fruit.id} disabled={fruit.readyCount <= 0}>{fruit.name}（持有 {fruit.readyCount}）</option>)}</select><button className="secondary-button" onClick={() => onFeed(feedFruitId)} disabled={!garden.fruits.some((fruit) => fruit.readyCount > 0)}>餵食靈果 <span>+飽食</span></button></div><button className="secondary-button" onClick={onPlay} disabled={!interactionAvailable}>陪伴互動 <span>{interactionAvailable ? '+心情' : interactionLabel}</span></button></div>
  </section>
}
