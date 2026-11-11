export type View = 'home' | 'study' | 'cultivation' | 'cave' | 'collection'

export type Subject = string

export type SubjectDifficulty = '入門' | '進階' | '困難'
export type SubjectQuality = '普通' | '優良' | '稀有'
export type StudyYear = 1 | 2 | 3 | 4
export type Semester = '上' | '下'

export type PetMood = '專注' | '開心' | '慵懶' | '興奮'

export interface PetCombatStats {
  attack: number
  defense: number
  spirit: number
  agility: number
}

export interface PetState {
  name: string
  species: string
  hunger: number
  mood: number
  energy: number
  intimacy: number
  evolutionStage: number
  combatStats: PetCombatStats
}

export interface RealmBreakthrough {
  id: string
  realmIndex: number
  completedAt: string
  rewardStones: number
}

export interface StudySession {
  id: string
  subject: Subject
  minutes: number
  difficulty: SubjectDifficulty
  quality: SubjectQuality
  rewardExp: number
  rewardStones: number
  completedAt: string
}

export interface StudySubject {
  id: string
  name: Subject
  difficulty: SubjectDifficulty
  quality: SubjectQuality
  year?: StudyYear
  semester?: Semester
  credits?: number
  source?: string
  fruitTypeId?: string
}

export interface MedicalCourse {
  id: string
  name: string
  year: StudyYear
  semester: Semester
  credits: number
}

export interface StudyTask {
  id: string
  title: string
  subject: Subject
  targetMinutes: number
  progressMinutes?: number
  completed: boolean
  createdDate?: string
}

export interface FruitStock {
  id: string
  name: string
  subject: Subject
  icon: string
  color: string
  progressMinutes: number
  targetMinutes: number
  readyCount: number
  totalHarvested: number
}

export interface FruitGarden {
  fruits: FruitStock[]
}

export type ItemRarity = '稀有' | '史詩' | '傳說'

export interface CollectionItem {
  id: string
  name: string
  description: string
  icon: string
  rarity: ItemRarity
  foundAt: string
  quantity: number
}

export interface ExplorationSession {
  id: string
  activity: string
  minutes: number
  completedAt: string
}

export interface MaterialStock {
  name: string
  icon: string
  amount: number
}

export interface CaveFurniture {
  id: string
  name: string
  icon: string
  description: string
  cost: number
  owned: number
  placed: boolean
}

export interface LifetimeStats {
  feedCount: number
  craftCount: number
  furnitureCount: number
}

export interface AchievementProgress {
  id: string
  progress: number
  claimed: boolean
}

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  target: number
  rewardExp: number
  rewardStones: number
  icon: string
}

export interface RecipeRequirement {
  materialName: string
  amount: number
}

export interface PetRecipe {
  id: string
  name: string
  icon: string
  description: string
  requirements: RecipeRequirement[]
  effect: string
  combatBoost?: Partial<PetCombatStats>
}

export type DailyTaskKind = 'studyMinutes' | 'feedPet' | 'explore' | 'harvestFruit'

export interface DailyTask {
  id: string
  title: string
  description: string
  kind: DailyTaskKind
  target: number
  progress: number
  rewardExp: number
  rewardStones: number
  claimed: boolean
}

export interface GameState {
  pet: PetState
  spiritStones: number
  sessions: StudySession[]
  tasks: StudyTask[]
  subjects: StudySubject[]
  fruitGarden: FruitGarden
  collectionItems: CollectionItem[]
  explorationSessions: ExplorationSession[]
  materials: MaterialStock[]
  dailyTasks: DailyTask[]
  dailyTaskDate: string
  playerName: string
  dailyGoal: number
  cultivationExp: number
  realmIndex: number
  breakthroughs: RealmBreakthrough[]
  lastInteractionSlot: string | null
  lastEnergyRecoveryAt: string
  caveFurniture: CaveFurniture[]
  achievements: AchievementProgress[]
  lifetimeStats: LifetimeStats
}
