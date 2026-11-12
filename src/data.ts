import type { AchievementDefinition, CaveFurniture, DailyTask, GameState, FruitStock, MedicalCourse, PetMood, PetRecipe, StudyYear, Subject, SubjectDifficulty, SubjectQuality, StudySubject, View } from './types'
import { localDateKey } from './utils/date'

const today = () => localDateKey()

export const fruitCatalog: FruitStock[] = [
  { id: 'fruit-ink', name: '墨香果', subject: '國文', icon: '✒', color: '#c79c75', progressMinutes: 0, targetMinutes: 60, readyCount: 0, totalHarvested: 0 },
  { id: 'fruit-star', name: '星語果', subject: '英文', icon: '✦', color: '#8aa9d2', progressMinutes: 20, targetMinutes: 60, readyCount: 0, totalHarvested: 3 },
  { id: 'fruit-abacus', name: '算盤果', subject: '數學', icon: '⊙', color: '#d4a95f', progressMinutes: 0, targetMinutes: 60, readyCount: 0, totalHarvested: 0 },
  { id: 'fruit-spirit', name: '靈識果', subject: '專業科目', icon: '◈', color: '#9a83bb', progressMinutes: 0, targetMinutes: 60, readyCount: 0, totalHarvested: 0 },
  { id: 'fruit-medicine', name: '玄醫果', subject: '醫學', icon: '✚', color: '#d28c93', progressMinutes: 0, targetMinutes: 60, readyCount: 0, totalHarvested: 0 },
]

const subjectFruitAliases: Record<string, string> = {
  國文: 'fruit-ink',
  英文: 'fruit-star',
  數學: 'fruit-abacus',
  專業科目: 'fruit-spirit',
  醫學: 'fruit-medicine',
}

export const getFruitKind = (subject: Subject, fruitTypeId?: string): FruitStock => {
  const directId = fruitTypeId ?? subjectFruitAliases[subject]
  const known = fruitCatalog.find((fruit) => fruit.id === directId)
  if (known) return { ...known }
  const hash = [...subject].reduce((total, character) => total + character.charCodeAt(0), 0)
  return { ...fruitCatalog[hash % fruitCatalog.length] }
}

export const getMedicalFruitTypeId = (_course: MedicalCourse, index: number) => fruitCatalog[index % fruitCatalog.length].id

// Source: Chang Gung University, Department of Medicine,
// "115學年度醫學系必選修科目表" (適用115學年度入學學生), required-course section.
export const medicalRequiredCourses: MedicalCourse[] = [
  { id: 'med-1-1-biology', name: '生物學(1)', year: 1, semester: '上', credits: 2 },
  { id: 'med-1-1-organic', name: '有機化學', year: 1, semester: '上', credits: 3 },
  { id: 'med-1-1-organic-lab', name: '有機化學實驗', year: 1, semester: '上', credits: 1 },
  { id: 'med-1-1-calculus', name: '醫用微積分', year: 1, semester: '上', credits: 2 },
  { id: 'med-1-1-pe', name: '體育（大一上）', year: 1, semester: '上', credits: 0 },
  { id: 'med-1-2-biology-lab', name: '生物學實驗', year: 1, semester: '下', credits: 1 },
  { id: 'med-1-2-physical-chem', name: '物理化學(含分析)', year: 1, semester: '下', credits: 3 },
  { id: 'med-1-2-physical-chem-lab', name: '物理化學實驗(含分析)', year: 1, semester: '下', credits: 1 },
  { id: 'med-1-2-physics', name: '物理學(含實驗)', year: 1, semester: '下', credits: 2 },
  { id: 'med-1-2-pe', name: '體育（大一下）', year: 1, semester: '下', credits: 0 },
  { id: 'med-1-2-hospital', name: '初步見識醫院(一)', year: 1, semester: '下', credits: 0.5 },
  { id: 'med-2-1-english', name: '醫學英文', year: 2, semester: '上', credits: 2 },
  { id: 'med-2-1-biochem', name: '生物化學', year: 2, semester: '上', credits: 4 },
  { id: 'med-2-1-biochem-lab', name: '生物化學實驗', year: 2, semester: '上', credits: 1 },
  { id: 'med-2-1-pbl', name: '問題導向式基礎醫學分組討論', year: 2, semester: '上', credits: 1 },
  { id: 'med-2-1-pe', name: '體育（大二上）', year: 2, semester: '上', credits: 0 },
  { id: 'med-2-1-hospital', name: '初步見識醫院(二)', year: 2, semester: '上', credits: 0.5 },
  { id: 'med-2-2-research', name: '醫學研究導論', year: 2, semester: '下', credits: 2 },
  { id: 'med-2-2-microbiology', name: '微生物學', year: 2, semester: '下', credits: 2 },
  { id: 'med-2-2-immunology', name: '免疫學', year: 2, semester: '下', credits: 2 },
  { id: 'med-2-2-microbiology-lab', name: '微生物免疫學實驗', year: 2, semester: '下', credits: 1 },
  { id: 'med-2-2-epidemiology', name: '公共衛生學:流行病學', year: 2, semester: '下', credits: 2 },
  { id: 'med-2-2-biostatistics', name: '生物統計學', year: 2, semester: '下', credits: 2 },
  { id: 'med-2-2-pe', name: '體育（大二下）', year: 2, semester: '下', credits: 0 },
  { id: 'med-3-1-anatomy', name: '大體解剖學', year: 3, semester: '上', credits: 3 },
  { id: 'med-3-1-anatomy-lab', name: '大體解剖學實驗', year: 3, semester: '上', credits: 4 },
  { id: 'med-3-1-embryology', name: '胚胎及發育生物學', year: 3, semester: '上', credits: 1 },
  { id: 'med-3-1-histology', name: '組織學', year: 3, semester: '上', credits: 2 },
  { id: 'med-3-1-histology-lab', name: '組織學實驗', year: 3, semester: '上', credits: 2 },
  { id: 'med-3-1-imaging-anatomy', name: '影像解剖學', year: 3, semester: '上', credits: 1 },
  { id: 'med-3-1-environmental', name: '公共衛生學:環境醫學', year: 3, semester: '上', credits: 2 },
  { id: 'med-3-2-preventive', name: '公共衛生學:預防醫學', year: 3, semester: '下', credits: 2 },
  { id: 'med-3-2-physiology', name: '生理學', year: 3, semester: '下', credits: 3 },
  { id: 'med-3-2-physiology-lab', name: '生理學實驗', year: 3, semester: '下', credits: 1 },
  { id: 'med-3-2-neurobiology', name: '神經生物學', year: 3, semester: '下', credits: 2 },
  { id: 'med-3-2-genetics', name: '醫學遺傳學', year: 3, semester: '下', credits: 2 },
  { id: 'med-3-2-parasitology', name: '寄生蟲學', year: 3, semester: '下', credits: 2 },
  { id: 'med-3-2-parasitology-lab', name: '寄生蟲學實驗', year: 3, semester: '下', credits: 1 },
  { id: 'med-3-2-thanatology', name: '生死學', year: 3, semester: '下', credits: 2 },
  { id: 'med-4-1-pathology', name: '病理學', year: 4, semester: '上', credits: 5 },
  { id: 'med-4-1-pathology-lab', name: '病理學實驗', year: 4, semester: '上', credits: 2 },
  { id: 'med-4-1-pathophysiology', name: '病態生理學', year: 4, semester: '上', credits: 2 },
  { id: 'med-4-1-community', name: '社區醫學', year: 4, semester: '上', credits: 1 },
  { id: 'med-4-1-pharmacology', name: '藥理學', year: 4, semester: '上', credits: 4 },
  { id: 'med-4-1-pharmacology-lab', name: '藥理學實驗', year: 4, semester: '上', credits: 1 },
  { id: 'med-4-2-humanities', name: '醫療人文與臨床倫理', year: 4, semester: '下', credits: 2 },
  { id: 'med-4-2-quality', name: '醫療品質', year: 4, semester: '下', credits: 1 },
  { id: 'med-4-2-regulation', name: '醫療法規', year: 4, semester: '下', credits: 1 },
  { id: 'med-4-2-diagnostics', name: '臨床診斷學', year: 4, semester: '下', credits: 1 },
  { id: 'med-4-2-diagnostics-practice', name: '臨床診斷學實習', year: 4, semester: '下', credits: 2 },
  { id: 'med-4-2-clinical-skills', name: '臨床技巧與溝通(含實習)', year: 4, semester: '下', credits: 2 },
  { id: 'med-4-2-lab-diagnostics', name: '實驗診斷學(含見習)', year: 4, semester: '下', credits: 2 },
  { id: 'med-4-2-intro-clinical', name: '臨床醫學緒論', year: 4, semester: '下', credits: 0.5 },
  { id: 'med-4-2-cardiovascular', name: '心臟血管學', year: 4, semester: '下', credits: 1.5 },
  { id: 'med-4-2-respiratory', name: '呼吸學', year: 4, semester: '下', credits: 1 },
  { id: 'med-4-2-digestive', name: '消化肝膽學', year: 4, semester: '下', credits: 1.5 },
  { id: 'med-4-2-rheumatology', name: '風濕免疫及感染學', year: 4, semester: '下', credits: 1.5 },
  { id: 'med-4-2-endocrinology', name: '內分泌學', year: 4, semester: '下', credits: 1 },
  { id: 'med-4-2-research-writing', name: '醫學研究與論文寫作(1)', year: 4, semester: '下', credits: 0.5 },
]

export function getMedicalCourseProfile(course: MedicalCourse): Pick<StudySubject, 'difficulty' | 'quality'> {
  if (/體育|初步見識/.test(course.name)) return { difficulty: '入門', quality: '普通' }
  if (/實驗|實習|臨床|解剖|病理|藥理/.test(course.name)) return { difficulty: '困難', quality: '優良' }
  if (course.year >= 3 || course.credits >= 3) return { difficulty: '進階', quality: '稀有' }
  return { difficulty: '進階', quality: '優良' }
}

export const createDailyTasks = (): DailyTask[] => [
  { id: 'daily-focus', title: '靜心入定', description: '完成 60 分鐘讀書專注', kind: 'studyMinutes', target: 60, progress: 0, rewardExp: 60, rewardStones: 30, claimed: false },
  { id: 'daily-feed', title: '照料靈寵', description: '餵食噗比 1 次', kind: 'feedPet', target: 1, progress: 0, rewardExp: 20, rewardStones: 10, claimed: false },
  { id: 'daily-explore', title: '行走大世界', description: '完成 1 次休閒探險', kind: 'explore', target: 1, progress: 0, rewardExp: 30, rewardStones: 15, claimed: false },
  { id: 'daily-harvest', title: '靈田有成', description: '採收 1 枚靈果', kind: 'harvestFruit', target: 1, progress: 0, rewardExp: 40, rewardStones: 20, claimed: false },
]

export const furnitureCatalog: CaveFurniture[] = [
  { id: 'furniture-lotus-lamp', name: '青玉蓮燈', icon: '🏮', description: '柔和燈火讓洞府更有靈氣。', cost: 80, owned: 0, placed: false },
  { id: 'furniture-cloud-cushion', name: '雲朵蒲團', icon: '☁️', description: '適合每日入定的柔軟坐墊。', cost: 120, owned: 0, placed: false },
  { id: 'furniture-bamboo-shelf', name: '靈竹書架', icon: '📚', description: '收納典籍，也替讀書留下痕跡。', cost: 180, owned: 0, placed: false },
  { id: 'furniture-spirit-pool', name: '月華靈池', icon: '🌙', description: '月光落入池中，映照噗比的修行。', cost: 260, owned: 0, placed: false },
  { id: 'furniture-herb-rack', name: '百草藥架', icon: '🌿', description: '整理探索所得的奇珍材料。', cost: 220, owned: 0, placed: false },
  { id: 'furniture-jade-window', name: '遠山玉窗', icon: '🪟', description: '打開窗，就能看見大世界的遠山。', cost: 360, owned: 0, placed: false },
]

export const achievementCatalog: AchievementDefinition[] = [
  { id: 'achievement-study-60', title: '初入定', description: '累積專注讀書 60 分鐘', target: 60, rewardExp: 80, rewardStones: 40, icon: '◷' },
  { id: 'achievement-study-600', title: '勤修不輟', description: '累積專注讀書 600 分鐘', target: 600, rewardExp: 240, rewardStones: 120, icon: '✧' },
  { id: 'achievement-explore-3', title: '踏遍山河', description: '完成 3 次大世界探索', target: 3, rewardExp: 100, rewardStones: 60, icon: '◇' },
  { id: 'achievement-harvest-5', title: '靈田初成', description: '累積採收 5 枚靈果', target: 5, rewardExp: 100, rewardStones: 60, icon: '✿' },
  { id: 'achievement-craft-3', title: '初窺丹道', description: '完成 3 次靈寵配方製作', target: 3, rewardExp: 160, rewardStones: 80, icon: '✦' },
  { id: 'achievement-collection-5', title: '奇珍獵人', description: '收集 5 種大世界奇珍', target: 5, rewardExp: 180, rewardStones: 100, icon: '♧' },
]

export const initialGameState: GameState = {
  playerName: '居士大人',
  pet: {
    name: '噗比',
    species: '小豬',
    hunger: 82,
    mood: 88,
    energy: 74,
    intimacy: 61,
    evolutionStage: 1,
    combatStats: { attack: 0, defense: 0, spirit: 0, agility: 0 },
  },
  spiritStones: 0,
  dailyGoal: 60,
  subjects: [],
  sessions: [
    { id: 'seed-1', subject: '生物學(1)', minutes: 25, difficulty: '進階', quality: '優良', rewardExp: 375, rewardStones: 75, completedAt: '2026-11-09T08:20:00' },
    { id: 'seed-2', subject: '有機化學', minutes: 20, difficulty: '進階', quality: '稀有', rewardExp: 560, rewardStones: 112, completedAt: '2026-11-08T19:10:00' },
  ],
  tasks: [
    { id: 'task-1', title: '複習生物學重點', subject: '生物學(1)', targetMinutes: 25, progressMinutes: 0, completed: false, createdDate: today() },
    { id: 'task-2', title: '整理有機化學反應', subject: '有機化學', targetMinutes: 35, progressMinutes: 0, completed: false, createdDate: today() },
    { id: 'task-3', title: '完成醫用微積分題組', subject: '醫用微積分', targetMinutes: 30, progressMinutes: 30, completed: true, createdDate: today() },
  ],
  fruitGarden: { fruits: fruitCatalog.map((fruit) => ({ ...fruit, progressMinutes: 0, readyCount: 0, totalHarvested: 0 })) },
  collectionItems: [],
  explorationSessions: [],
  materials: [],
  dailyTasks: createDailyTasks(),
  dailyTaskDate: today(),
  cultivationExp: 0,
  realmIndex: 0,
  breakthroughs: [],
  lastInteractionSlot: null,
  lastEnergyRecoveryAt: new Date().toISOString(),
  caveFurniture: furnitureCatalog.map((item) => ({ ...item })),
  achievements: achievementCatalog.map((item) => ({ id: item.id, progress: 0, claimed: false })),
  lifetimeStats: { feedCount: 0, craftCount: 0, furnitureCount: 0 },
}

export const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: 'home', label: '洞府', icon: '⌂' },
  { id: 'study', label: '伴讀', icon: '◷' },
  { id: 'cultivation', label: '修煉', icon: '✦' },
  { id: 'cave', label: '洞府佈置', icon: '◇' },
  { id: 'collection', label: '藏寶閣', icon: '♧' },
]

export const subjects: Subject[] = ['全部']

export const difficultyOptions: SubjectDifficulty[] = ['入門', '進階', '困難']
export const qualityOptions: SubjectQuality[] = ['普通', '優良', '稀有']

export const difficultyMultiplier: Record<SubjectDifficulty, number> = {
  入門: 1,
  進階: 1.35,
  困難: 1.75,
}

export const qualityMultiplier: Record<SubjectQuality, number> = {
  普通: 1,
  優良: 1.25,
  稀有: 1.6,
}

export function getSubjectReward(subject: StudySubject | undefined, minutes: number) {
  const difficulty = subject?.difficulty ?? '入門'
  const quality = subject?.quality ?? '普通'
  const multiplier = difficultyMultiplier[difficulty] * qualityMultiplier[quality]
  return {
    exp: Math.round(minutes * 2 * multiplier),
    stones: Math.max(1, Math.round(minutes * multiplier)),
    difficulty,
    quality,
  }
}

export const rareWorldFinds = [
  { name: '流螢玉佩', description: '在夜色裡微微發光的古老玉佩。', icon: '◈', rarity: '稀有' as const, material: { name: '流螢玉屑', icon: '◈' } },
  { name: '雲中花籤', description: '記錄著未知仙境座標的花瓣。', icon: '❀', rarity: '稀有' as const, material: { name: '雲中花瓣', icon: '❀' } },
  { name: '星砂羅盤', description: '只會指向下一個奇遇的神秘羅盤。', icon: '✧', rarity: '史詩' as const, material: { name: '星砂', icon: '✧' } },
  { name: '太初金羽', description: '傳說靈獸遺落的金色羽毛。', icon: '♢', rarity: '傳說' as const, material: { name: '太初金羽', icon: '♢' } },
  { name: '月影石', description: '吸收月華後會散發微光的靈石。', icon: '◐', rarity: '稀有' as const, material: { name: '月影碎片', icon: '◐' } },
  { name: '青鸞羽飾', description: '帶著遠古飛禽氣息的羽飾。', icon: '❖', rarity: '史詩' as const, material: { name: '青鸞羽片', icon: '❖' } },
  { name: '龍紋玉簡', description: '刻著未知功法的殘缺玉簡。', icon: '▱', rarity: '傳說' as const, material: { name: '龍紋玉屑', icon: '▱' } },
]

export const petRecipes: PetRecipe[] = [
  { id: 'recipe-spirit-snack', name: '聚靈果脯', icon: '🍡', description: '用星砂與花瓣製成的甜點，噗比很喜歡。', requirements: [{ materialName: '星砂', amount: 2 }, { materialName: '雲中花瓣', amount: 1 }], effect: '精力 +12、親密 +4', combatBoost: { spirit: 2 } },
  { id: 'recipe-luminous-pendant', name: '流螢護符', icon: '◈', description: '讓靈寵在探險與修煉時更容易保持好心情。', requirements: [{ materialName: '流螢玉屑', amount: 2 }, { materialName: '太初金羽', amount: 1 }], effect: '心情 +12、親密 +8', combatBoost: { defense: 3, agility: 1 } },
  { id: 'recipe-moonstone-collar', name: '月影靈圈', icon: '◐', description: '以月影石打造的靈圈，提升噗比的靈力。', requirements: [{ materialName: '月影碎片', amount: 2 }, { materialName: '青鸞羽片', amount: 1 }], effect: '靈力 +4', combatBoost: { spirit: 4 } },
  { id: 'recipe-dragon-charm', name: '龍紋護心符', icon: '▱', description: '刻有龍紋的護心符，讓噗比更勇敢。', requirements: [{ materialName: '龍紋玉屑', amount: 2 }, { materialName: '太初金羽', amount: 1 }], effect: '攻擊 +5、防禦 +2', combatBoost: { attack: 5, defense: 2 } },
]

export const petMoods: Record<PetMood, { label: string; icon: string }> = {
  專注: { label: '靈台清明', icon: '✧' },
  開心: { label: '心情愉悅', icon: '☼' },
  慵懶: { label: '需要休息', icon: '☾' },
  興奮: { label: '靈氣充沛', icon: '✦' },
}

export const getPetMood = (mood: number, energy: number): PetMood => {
  if (energy < 30) return '慵懶'
  if (mood > 90) return '興奮'
  if (mood > 75) return '開心'
  return '專注'
}

export const petEvolutionStages = [
  { stage: 1, name: '靈氣小豬', subtitle: '剛踏上修煉之路', stoneCost: 0, requirements: [], icon: '🐷', color: '#e9aaa9', combatBoost: {} },
  { stage: 2, name: '玉心噗比', subtitle: '靈氣凝成玉色心印', stoneCost: 1000, requirements: [{ materialName: '流螢玉屑', amount: 3 }, { materialName: '星砂', amount: 2 }, { materialName: '雲中花瓣', amount: 1 }], icon: '🐷', color: '#e8c4a9', combatBoost: { defense: 4, spirit: 3 } },
  { stage: 3, name: '玄玉豬王', subtitle: '守護洞府的稀有靈寵', stoneCost: 3500, requirements: [{ materialName: '太初金羽', amount: 3 }, { materialName: '龍紋玉屑', amount: 2 }, { materialName: '青鸞羽片', amount: 2 }], icon: '🐽', color: '#c99a9f', combatBoost: { attack: 8, defense: 5, agility: 3 } },
]

export const realmData = [
  { name: '凡人境', phase: '前期', subtitle: '初入仙途', requirement: 0, color: '#a2a9bc' },
  { name: '凡人境', phase: '中期', subtitle: '初識靈息', requirement: 120, color: '#a2a9bc' },
  { name: '凡人境', phase: '後期', subtitle: '凡軀淬鍊', requirement: 360, color: '#a2a9bc' },
  { name: '煉氣期', phase: '前期', subtitle: '引氣入體', requirement: 900, color: '#83b9aa' },
  { name: '煉氣期', phase: '中期', subtitle: '氣走周天', requirement: 2200, color: '#83b9aa' },
  { name: '煉氣期', phase: '後期', subtitle: '靈氣充盈', requirement: 5000, color: '#83b9aa' },
  { name: '築基期', phase: '前期', subtitle: '道基初成', requirement: 9000, color: '#6ba4c5' },
  { name: '築基期', phase: '中期', subtitle: '基台穩固', requirement: 17000, color: '#6ba4c5' },
  { name: '築基期', phase: '後期', subtitle: '道基圓滿', requirement: 25000, color: '#6ba4c5' },
  { name: '金丹期', phase: '前期', subtitle: '丹成一品', requirement: 33000, color: '#d6a85a' },
  { name: '金丹期', phase: '中期', subtitle: '金丹凝實', requirement: 41000, color: '#d6a85a' },
  { name: '金丹期', phase: '後期', subtitle: '丹蘊神通', requirement: 49000, color: '#d6a85a' },
  { name: '元嬰期', phase: '前期', subtitle: '嬰火不滅', requirement: 57000, color: '#aa83c4' },
  { name: '元嬰期', phase: '中期', subtitle: '元嬰初成', requirement: 65000, color: '#aa83c4' },
  { name: '元嬰期', phase: '後期', subtitle: '神嬰圓融', requirement: 73000, color: '#aa83c4' },
  { name: '化神期', phase: '前期', subtitle: '神遊太虛', requirement: 81000, color: '#d17b83' },
  { name: '化神期', phase: '中期', subtitle: '神念化界', requirement: 89000, color: '#d17b83' },
  { name: '化神期', phase: '後期', subtitle: '道化天地', requirement: 97000, color: '#d17b83' },
]
