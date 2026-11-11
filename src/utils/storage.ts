import type { GameState } from '../types'
import { achievementCatalog, createDailyTasks, fruitCatalog, furnitureCatalog, getFruitKind, getMedicalCourseProfile, getMedicalFruitTypeId, medicalRequiredCourses, realmData } from '../data'
import { localDateKey } from './date'

const STORAGE_KEY = 'cultivation-companion-state-v1'
const RESOURCE_RESET_KEY = 'cultivation-companion-phase2-resource-reset-v1'
export const TEST_STUDY_DATA_CLEANUP_KEY = 'cultivation-companion-test-study-data-cleanup-v1'
export const PET_ACHIEVEMENT_RESET_KEY = 'cultivation-companion-pet-achievement-reset-v1'
const LATEST_STUDY_ACHIEVEMENT_CLEANUP_KEY = 'cultivation-companion-study-achievement-cleanup-v2'

export function clearStudyTestData(state: GameState): GameState {
  return { ...state, sessions: [], tasks: [], dailyTasks: createDailyTasks(), dailyTaskDate: localDateKey() }
}

export function clearStudyAndAchievementTestData(state: GameState): GameState {
  return {
    ...clearStudyTestData(state),
    achievements: achievementCatalog.map((achievement) => ({ id: achievement.id, progress: 0, claimed: false })),
  }
}

export function resetPetAndAchievements(state: GameState): GameState {
  return {
    ...state,
    pet: { ...state.pet, hunger: 100, mood: 100, energy: 100, intimacy: 100, combatStats: { ...state.pet.combatStats } },
    achievements: achievementCatalog.map((achievement) => ({ id: achievement.id, progress: 0, claimed: false })),
    lastEnergyRecoveryAt: new Date().toISOString(),
  }
}

export function loadGameState(fallback: GameState): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return fallback
    const parsed = JSON.parse(saved) as Partial<GameState>
    const removedLegacySubjects = new Set(['國文', '英文', '數學', '專業科目'])
    const officialSubjects = medicalRequiredCourses.map((course, index) => ({ id: course.id, name: course.name, ...getMedicalCourseProfile(course), year: course.year, semester: course.semester, credits: course.credits, fruitTypeId: getMedicalFruitTypeId(course, index), source: '長庚大學醫學系 115 學年度必選修科目表' }))
    const savedSubjects = parsed.subjects?.length ? parsed.subjects : fallback.subjects
    const customSubjects = savedSubjects.filter((subject) => subject.source === 'user').map((subject) => ({ ...subject, fruitTypeId: subject.fruitTypeId ?? getFruitKind(subject.name).id }))
    const subjects = [...officialSubjects, ...customSubjects]
    const taskDate = localDateKey()
    const tasks = (parsed.tasks ?? fallback.tasks)
      .filter((task) => !removedLegacySubjects.has(task.subject))
      .filter((task) => !task.createdDate || task.createdDate === taskDate)
      .map((task) => ({ ...task, createdDate: task.createdDate ?? taskDate, progressMinutes: Math.min(task.targetMinutes, task.progressMinutes ?? (task.completed ? task.targetMinutes : 0)) }))
    const savedFruit = parsed.fruitGarden as (Partial<GameState['fruitGarden']> & { fruitName?: string; progressMinutes?: number; targetMinutes?: number; readyCount?: number; totalHarvested?: number }) | undefined
    const savedFruitRows = savedFruit && Array.isArray(savedFruit.fruits)
      ? savedFruit.fruits
      : fruitCatalog.map((fruit, index) => ({ ...fruit, progressMinutes: index === 1 ? savedFruit?.progressMinutes ?? fruit.progressMinutes : fruit.progressMinutes, readyCount: index === 1 ? savedFruit?.readyCount ?? fruit.readyCount : fruit.readyCount, totalHarvested: index === 1 ? savedFruit?.totalHarvested ?? fruit.totalHarvested : fruit.totalHarvested }))
    const fruitGarden = { fruits: fruitCatalog.map((fruit) => { const rows = savedFruitRows.filter((row) => getFruitKind(row.subject ?? row.name, row.id).id === fruit.id || row.id === fruit.id); const rawProgress = rows.reduce((sum, row) => sum + row.progressMinutes, 0); return { ...fruit, progressMinutes: rawProgress % fruit.targetMinutes, readyCount: rows.reduce((sum, row) => sum + row.readyCount, 0) + Math.floor(rawProgress / fruit.targetMinutes), totalHarvested: rows.reduce((sum, row) => sum + row.totalHarvested, 0) } }) }
    const totalExp = (parsed.sessions ?? []).reduce((sum, session) => sum + (session.rewardExp ?? session.minutes * 10), 0) + 500
    const inferredRealmIndex = [...realmData].reverse().findIndex((realm) => totalExp >= realm.requirement)
    const fallbackRealmIndex = inferredRealmIndex < 0 ? 0 : realmData.length - 1 - inferredRealmIndex
    const state: GameState = {
      ...fallback,
      ...parsed,
      playerName: parsed.playerName === '清心居士' || !parsed.playerName ? fallback.playerName : parsed.playerName,
      pet: { ...fallback.pet, ...parsed.pet, name: parsed.pet?.name === '小玄' || !parsed.pet?.name ? fallback.pet.name : parsed.pet.name, species: parsed.pet?.species === '月兔' || !parsed.pet?.species ? fallback.pet.species : parsed.pet.species, evolutionStage: parsed.pet?.evolutionStage ?? fallback.pet.evolutionStage, combatStats: { ...fallback.pet.combatStats, ...parsed.pet?.combatStats } },
      subjects,
      sessions: (parsed.sessions ?? []).filter((session) => !removedLegacySubjects.has(session.subject)).map((session) => { const meta = subjects.find((subject) => subject.name === session.subject); return { ...session, difficulty: session.difficulty ?? meta?.difficulty ?? '入門', quality: session.quality ?? meta?.quality ?? '普通', rewardExp: session.rewardExp ?? session.minutes * 10, rewardStones: session.rewardStones ?? session.minutes * 2 } }),
      tasks,
      fruitGarden,
      collectionItems: (parsed.collectionItems ?? fallback.collectionItems).map((item) => ({ ...item, quantity: item.quantity ?? 1 })),
      explorationSessions: parsed.explorationSessions ?? fallback.explorationSessions,
      materials: parsed.materials ?? fallback.materials,
      dailyTasks: parsed.dailyTaskDate === fallback.dailyTaskDate && parsed.dailyTasks?.length ? parsed.dailyTasks : createDailyTasks(),
      dailyTaskDate: fallback.dailyTaskDate,
      cultivationExp: parsed.cultivationExp ?? fallback.cultivationExp,
      realmIndex: parsed.cultivationExp === undefined ? fallbackRealmIndex : (parsed.realmIndex ?? fallback.realmIndex),
      breakthroughs: parsed.breakthroughs ?? fallback.breakthroughs,
      lastInteractionSlot: parsed.lastInteractionSlot ?? fallback.lastInteractionSlot,
      lastEnergyRecoveryAt: parsed.lastEnergyRecoveryAt ?? new Date().toISOString(),
      caveFurniture: furnitureCatalog.map((item) => ({ ...item, ...(parsed.caveFurniture ?? []).find((savedItem) => savedItem.id === item.id) })),
      achievements: achievementCatalog.map((definition) => ({ id: definition.id, progress: Math.max(0, parsed.achievements?.find((item) => item.id === definition.id)?.progress ?? 0), claimed: parsed.achievements?.find((item) => item.id === definition.id)?.claimed ?? false })),
      lifetimeStats: { ...fallback.lifetimeStats, ...parsed.lifetimeStats },
    }
    if (localStorage.getItem(RESOURCE_RESET_KEY) !== 'done') {
      localStorage.setItem(RESOURCE_RESET_KEY, 'done')
      localStorage.setItem(TEST_STUDY_DATA_CLEANUP_KEY, 'done')
      localStorage.setItem(PET_ACHIEVEMENT_RESET_KEY, 'done')
      return {
        ...state,
        sessions: [],
        tasks: [],
        dailyTasks: createDailyTasks(),
        dailyTaskDate: localDateKey(),
        spiritStones: 0,
        cultivationExp: 0,
        realmIndex: 0,
        breakthroughs: [],
        materials: [],
        collectionItems: [],
        explorationSessions: [],
        fruitGarden: { fruits: fruitCatalog.map((fruit) => ({ ...fruit, progressMinutes: 0, readyCount: 0, totalHarvested: 0 })) },
        pet: { ...state.pet, hunger: 100, mood: 100, energy: 100, intimacy: 100, combatStats: { attack: 0, defense: 0, spirit: 0, agility: 0 } },
        achievements: achievementCatalog.map((achievement) => ({ id: achievement.id, progress: 0, claimed: false })),
        lastInteractionSlot: null,
        lastEnergyRecoveryAt: new Date().toISOString(),
      }
    }
    if (localStorage.getItem(TEST_STUDY_DATA_CLEANUP_KEY) !== 'done') {
      localStorage.setItem(TEST_STUDY_DATA_CLEANUP_KEY, 'done')
      return clearStudyTestData(state)
    }
    if (localStorage.getItem(PET_ACHIEVEMENT_RESET_KEY) !== 'done') {
      localStorage.setItem(PET_ACHIEVEMENT_RESET_KEY, 'done')
      return resetPetAndAchievements(state)
    }
    if (localStorage.getItem(LATEST_STUDY_ACHIEVEMENT_CLEANUP_KEY) !== 'done') {
      localStorage.setItem(LATEST_STUDY_ACHIEVEMENT_CLEANUP_KEY, 'done')
      return clearStudyAndAchievementTestData(state)
    }
    return state
  } catch {
    return fallback
  }
}

export function saveGameState(state: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
