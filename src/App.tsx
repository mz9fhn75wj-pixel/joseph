import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Layout } from './components/Layout'
import { PetCard } from './components/PetCard'
import { ProgressCard } from './components/ProgressCard'
import { StudyTimer } from './components/StudyTimer'
import { FruitGardenCard } from './components/FruitGardenCard'
import { WorldExploreCard } from './components/WorldExploreCard'
import { DailyTasksCard } from './components/DailyTasksCard'
import { CaveFurniturePanel } from './components/CaveFurniturePanel'
import { InventoryPanel } from './components/InventoryPanel'
import { AchievementPanel } from './components/AchievementPanel'
import { StatisticsPanel } from './components/StatisticsPanel'
import { achievementCatalog, createDailyTasks, difficultyOptions, furnitureCatalog, fruitCatalog, getFruitKind, getMedicalCourseProfile, getMedicalFruitTypeId, getSubjectReward, initialGameState, medicalRequiredCourses, petRecipes, qualityOptions, rareWorldFinds, realmData } from './data'
import { clearStudyAndAchievementTestData, clearStudyTestData, loadGameState, makeId, PET_ACHIEVEMENT_RESET_KEY, resetPetAndAchievements, saveGameState, TEST_STUDY_DATA_CLEANUP_KEY } from './utils/storage'
import { playSound, readSoundEnabled, setSoundEnabled } from './utils/sound'
import { getCloudSession, loadCloudSnapshot, saveCloudSnapshot, signInCloud, signOutCloud, signUpCloud, type CloudSession } from './utils/cloudSync'
import { localDateKey } from './utils/date'
import type { GameState, Subject, SubjectDifficulty, SubjectQuality, View } from './types'

const today = () => localDateKey()
const CLOUD_TEST_STUDY_DATA_CLEANUP_KEY = 'cultivation-companion-cloud-test-study-data-cleanup-v2'
const CLOUD_PET_ACHIEVEMENT_RESET_KEY = 'cultivation-companion-cloud-pet-achievement-reset-v1'

function getInteractionSlot(date: Date) {
  const hour = date.getHours()
  const slot = hour >= 8 && hour < 14 ? 'morning' : hour >= 14 && hour < 20 ? 'afternoon' : 'evening'
  const slotDate = new Date(date)
  if (hour < 8) slotDate.setDate(slotDate.getDate() - 1)
  const dateKey = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`
  const nextReset = hour < 8 ? '08:00' : hour < 14 ? '14:00' : hour < 20 ? '20:00' : '08:00'
  const label = slot === 'morning' ? '早上時段' : slot === 'afternoon' ? '下午時段' : '晚上時段'
  return { key: `${dateKey}-${slot}`, label, nextReset }
}

function syncAchievements(state: GameState): GameState {
  const studyMinutes = state.sessions.reduce((sum, session) => sum + session.minutes, 0)
  const harvested = state.fruitGarden.fruits.reduce((sum, fruit) => sum + fruit.totalHarvested, 0)
  const values: Record<string, number> = {
    'achievement-study-60': studyMinutes,
    'achievement-study-600': studyMinutes,
    'achievement-explore-3': state.explorationSessions.length,
    'achievement-harvest-5': harvested,
    'achievement-craft-3': state.lifetimeStats.craftCount,
    'achievement-collection-5': state.collectionItems.length,
  }
  return { ...state, achievements: achievementCatalog.map((definition) => { const previous = state.achievements.find((item) => item.id === definition.id); return { id: definition.id, progress: Math.max(previous?.progress ?? 0, values[definition.id] ?? 0), claimed: previous?.claimed ?? false } }) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function App() {
  const [activeView, setActiveView] = useState<View>('home')
  const [game, setGame] = useState<GameState>(() => {
    const saved = syncAchievements(loadGameState(initialGameState))
    return saved.dailyTaskDate === today() ? saved : { ...saved, dailyTasks: createDailyTasks(), dailyTaskDate: today() }
  })
  const [selectedSubject, setSelectedSubject] = useState<Exclude<Subject, '全部'>>(medicalRequiredCourses[0]?.name ?? '')
  const [toast, setToast] = useState('')
  const [soundEnabled, setSoundEnabledState] = useState(readSoundEnabled)
  const [showTimer, setShowTimer] = useState(false)
  const [filter, setFilter] = useState<Subject>('全部')
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectDifficulty, setNewSubjectDifficulty] = useState<SubjectDifficulty>('進階')
  const [newSubjectQuality, setNewSubjectQuality] = useState<SubjectQuality>('普通')
  const [clockTick, setClockTick] = useState(Date.now())
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => getCloudSession())
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('')

  useEffect(() => {
    saveGameState(game)
    if (!cloudSession || !cloudReady) return
    const timer = window.setTimeout(() => {
      saveCloudSnapshot(game, undefined, cloudSession).then(() => setCloudStatus('已自動同步最新進度。')).catch(() => setCloudStatus('雲端同步失敗，本機資料仍已保存。'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [game, cloudReady, cloudSession])
  useEffect(() => {
    let cancelled = false
    if (!cloudSession) {
      setCloudReady(false)
      setCloudStatus('')
      return () => { cancelled = true }
    }
    setCloudReady(false)
    setCloudStatus('正在讀取雲端存檔…')
    loadCloudSnapshot(cloudSession).then((snapshot) => {
      if (cancelled) return
      if (snapshot) {
        let cloudState = snapshot.state
        let shouldSaveCleanCloudState = false
        if (localStorage.getItem(CLOUD_TEST_STUDY_DATA_CLEANUP_KEY) !== 'done') {
          cloudState = clearStudyAndAchievementTestData(cloudState)
          localStorage.setItem(CLOUD_TEST_STUDY_DATA_CLEANUP_KEY, 'done')
          shouldSaveCleanCloudState = true
        }
        if (localStorage.getItem(CLOUD_PET_ACHIEVEMENT_RESET_KEY) !== 'done') {
          cloudState = resetPetAndAchievements(cloudState)
          localStorage.setItem(CLOUD_PET_ACHIEVEMENT_RESET_KEY, 'done')
          shouldSaveCleanCloudState = true
        }
        if (shouldSaveCleanCloudState) saveCloudSnapshot(cloudState, undefined, cloudSession).catch(() => setCloudStatus('本機初始化資料已調整，雲端更新稍後重試。'))
        setGame(syncAchievements(cloudState))
        setCloudStatus('已載入雲端進度。')
      } else {
        setCloudStatus('這是此帳號的第一台裝置，之後會自動上傳進度。')
      }
      setCloudReady(true)
      window.dispatchEvent(new CustomEvent('cultivation-companion-cloud-ready'))
    }).catch((error) => {
      if (!cancelled) setCloudStatus(error instanceof Error ? error.message : '雲端存檔讀取失敗。')
    })
    return () => { cancelled = true }
  }, [cloudSession?.userId])
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(id) }, [toast])
  useEffect(() => { const id = window.setInterval(() => setClockTick(Date.now()), 30000); return () => window.clearInterval(id) }, [])
  useEffect(() => {
    const dateKey = today()
    setGame((current) => {
      if (current.dailyTaskDate === dateKey) return current
      return syncAchievements({
        ...current,
        dailyTasks: createDailyTasks(),
        dailyTaskDate: dateKey,
        tasks: current.tasks.filter((task) => task.createdDate === dateKey),
      })
    })
  }, [clockTick])
  useEffect(() => {
    const recoverEnergy = () => setGame((current) => {
      const last = Date.parse(current.lastEnergyRecoveryAt)
      if (!Number.isFinite(last)) return { ...current, lastEnergyRecoveryAt: new Date().toISOString() }
      const intervals = Math.floor((Date.now() - last) / (3 * 60 * 1000))
      if (intervals <= 0) return current
      return { ...current, pet: { ...current.pet, energy: Math.min(100, current.pet.energy + intervals) }, lastEnergyRecoveryAt: new Date(last + intervals * 3 * 60 * 1000).toISOString() }
    })
    recoverEnergy()
    const id = window.setInterval(recoverEnergy, 30000)
    return () => window.clearInterval(id)
  }, [])

  const updateGame = (updater: (current: GameState) => GameState) => setGame((current) => syncAchievements(updater(current)))
  const addToast = (message: string) => {
    setToast(message)
    localStorage.setItem('cultivation-companion-pet-notice-v1', JSON.stringify({ message, at: Date.now() }))
  }
  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabledState(next)
    setSoundEnabled(next)
    if (next) playSound('click', next)
  }
  const exportSave = () => {
    const payload = { app: '修仙伴讀', version: 2, exportedAt: new Date().toISOString(), state: game }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `修仙伴讀存檔-${today()}.json`
    link.click()
    URL.revokeObjectURL(url)
    addToast('存檔已匯出，可以保存到雲端或傳到其他裝置。')
  }
  const importSave = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const candidate = isRecord(parsed) && isRecord(parsed.state) ? parsed.state : parsed
      if (!isRecord(candidate) || !isRecord(candidate.pet) || !Array.isArray(candidate.sessions) || !Array.isArray(candidate.subjects) || !isRecord(candidate.fruitGarden)) throw new Error('invalid save')
      const imported = candidate as unknown as Partial<GameState>
      const restored = {
        ...initialGameState,
        ...game,
        ...imported,
        pet: { ...game.pet, ...(imported.pet ?? {}), combatStats: { ...game.pet.combatStats, ...(imported.pet?.combatStats ?? {}) } },
        sessions: imported.sessions,
        subjects: imported.subjects,
        fruitGarden: imported.fruitGarden,
        tasks: imported.tasks ?? game.tasks,
        collectionItems: imported.collectionItems ?? game.collectionItems,
        explorationSessions: imported.explorationSessions ?? game.explorationSessions,
        materials: imported.materials ?? game.materials,
        dailyTasks: imported.dailyTasks ?? game.dailyTasks,
        breakthroughs: imported.breakthroughs ?? game.breakthroughs,
        caveFurniture: imported.caveFurniture ?? game.caveFurniture,
        achievements: imported.achievements ?? game.achievements,
        lifetimeStats: imported.lifetimeStats ?? game.lifetimeStats,
      } as GameState
      setGame(syncAchievements(restored))
      addToast('存檔匯入成功，修行進度已恢復。')
    } catch {
      addToast('存檔格式無法讀取，請選擇修仙伴讀匯出的 JSON 檔案。')
    }
  }
  const resetSave = () => {
    if (!window.confirm('確定要重置遊戲進度嗎？此操作不會刪除已上傳的 MP3，但遊戲資料會回到初始狀態。')) return
    localStorage.removeItem('cultivation-companion-state-v1')
    const freshState = resetPetAndAchievements(clearStudyTestData(loadGameState(initialGameState)))
    localStorage.setItem(TEST_STUDY_DATA_CLEANUP_KEY, 'done')
    localStorage.setItem(PET_ACHIEVEMENT_RESET_KEY, 'done')
    setGame({ ...freshState, lastEnergyRecoveryAt: new Date().toISOString() })
    addToast('遊戲資料已重置；本機 MP3 歌單仍然保留。')
  }
  const handleCloudSignIn = async (email: string, password: string) => {
    const session = await signInCloud(email, password)
    setCloudSession(session)
    addToast('雲端登入成功，正在同步所有裝置。')
  }
  const handleCloudSignUp = async (email: string, password: string) => {
    const session = await signUpCloud(email, password)
    if (session) {
      setCloudSession(session)
      addToast('帳號建立成功，正在同步所有裝置。')
    } else {
      throw new Error('註冊信已寄出，請先完成信箱驗證，再回來登入。')
    }
  }
  const handleCloudSignOut = () => {
    signOutCloud()
    setCloudSession(null)
    setCloudReady(false)
    setCloudStatus('已登出；本機資料仍保留。')
  }
  const uploadCloudSave = async () => {
    if (!cloudSession) return
    await saveCloudSnapshot(game, undefined, cloudSession)
    setCloudStatus('本機進度已上傳。')
  }
  const downloadCloudSave = async () => {
    if (!cloudSession) return
    const snapshot = await loadCloudSnapshot(cloudSession)
    if (!snapshot) return setCloudStatus('雲端目前沒有存檔。')
    setGame(syncAchievements(snapshot.state))
    setCloudReady(true)
    setCloudStatus('已下載雲端進度。')
    addToast('雲端進度已載入。')
    window.dispatchEvent(new CustomEvent('cultivation-companion-cloud-ready'))
  }
  const interactionSlot = getInteractionSlot(new Date(clockTick))
  const interactionAvailable = game.lastInteractionSlot !== interactionSlot.key
  const addDailyProgress = (tasks: GameState['dailyTasks'], kind: GameState['dailyTasks'][number]['kind'], amount: number) => tasks.map((task) => task.kind === kind && !task.claimed ? { ...task, progress: Math.min(task.target, task.progress + amount) } : task)

  const handleComplete = useCallback((minutes: number, subject: string) => {
    let reward = { exp: minutes * 2, stones: minutes, difficulty: '入門' as SubjectDifficulty, quality: '普通' as SubjectQuality }
    let grownFruit = 0
    updateGame((current) => {
      const subjectMeta = current.subjects.find((item) => item.name === subject)
      reward = getSubjectReward(subjectMeta, minutes)
      const fruitKind = getFruitKind(subject, current.subjects.find((item) => item.name === subject)?.fruitTypeId)
      const existingFruit = current.fruitGarden.fruits.find((fruit) => fruit.id === fruitKind.id) ?? fruitKind
      const totalFruitMinutes = existingFruit.progressMinutes + minutes
      grownFruit = Math.floor(totalFruitMinutes / existingFruit.targetMinutes)
      const fruitCombatBoost = ({ 'fruit-ink': { defense: 1 }, 'fruit-star': { agility: 1 }, 'fruit-abacus': { attack: 1 }, 'fruit-spirit': { spirit: 1 }, 'fruit-medicine': { defense: 1, spirit: 1 } } as Record<string, Partial<GameState['pet']['combatStats']>>)[fruitKind.id] ?? {}
      return {
        ...current,
        cultivationExp: current.cultivationExp + reward.exp,
        spiritStones: current.spiritStones + reward.stones,
        pet: { ...current.pet, energy: Math.max(15, current.pet.energy - Math.round(minutes / 4)), mood: Math.min(100, current.pet.mood + 5), intimacy: Math.min(100, current.pet.intimacy + Math.min(10, Math.round(minutes / 5))), combatStats: { ...current.pet.combatStats, ...fruitCombatBoost } },
        sessions: [...current.sessions, { id: makeId('session'), subject, minutes, difficulty: reward.difficulty, quality: reward.quality, rewardExp: reward.exp, rewardStones: reward.stones, completedAt: new Date().toISOString() }],
        tasks: current.tasks.map((task) => task.subject === subject && !task.completed ? { ...task, progressMinutes: Math.min(task.targetMinutes, (task.progressMinutes ?? 0) + minutes) } : task),
        fruitGarden: { fruits: [...current.fruitGarden.fruits.filter((fruit) => fruit.id !== fruitKind.id), { ...existingFruit, progressMinutes: totalFruitMinutes % existingFruit.targetMinutes, readyCount: existingFruit.readyCount + grownFruit }] },
        dailyTasks: addDailyProgress(current.dailyTasks, 'studyMinutes', minutes),
      }
    })
    setShowTimer(false)
    addToast(`入定完成！獲得 ${reward.exp} 點修為與 ${reward.stones} 顆靈石${grownFruit > 0 ? `，${grownFruit} 枚靈果成熟了` : ''}`)
    playSound('success', soundEnabled)
  }, [soundEnabled])

  const feedPet = (fruitId: string) => {
    const fruit = game.fruitGarden.fruits.find((item) => item.id === fruitId)
    if (!fruit || fruit.readyCount <= 0) return addToast('目前沒有可餵食的成熟靈果，先完成讀書累積靈果吧！')
    updateGame((current) => ({ ...current, pet: { ...current.pet, hunger: Math.min(100, current.pet.hunger + 12), mood: Math.min(100, current.pet.mood + 2) }, fruitGarden: { fruits: current.fruitGarden.fruits.map((item) => item.id === fruitId ? { ...item, readyCount: item.readyCount - 1 } : item) }, dailyTasks: addDailyProgress(current.dailyTasks, 'feedPet', 1), lifetimeStats: { ...current.lifetimeStats, feedCount: current.lifetimeStats.feedCount + 1 } }))
    addToast(`餵食${fruit.name}成功，噗比的飽食度提升了！`)
    playSound('feed', soundEnabled)
  }
  const playWithPet = () => {
    if (!interactionAvailable) return addToast(`本時段已完成陪伴，下一次將於 ${interactionSlot.nextReset} 重置`)
    updateGame((current) => ({ ...current, pet: { ...current.pet, mood: Math.min(100, current.pet.mood + 10), intimacy: Math.min(100, current.pet.intimacy + 3), energy: Math.max(0, current.pet.energy - 3) }, lastInteractionSlot: interactionSlot.key }))
    addToast(`${interactionSlot.label}陪伴互動完成！下一次將於 ${interactionSlot.nextReset} 重置。`)
    playSound('click', soundEnabled)
  }
  const toggleTask = (id: string) => updateGame((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task) }))
  const addStudyTask = (title: string, subject: string, targetMinutes: number) => {
    const trimmedTitle = title.trim()
    const minutes = Math.round(targetMinutes)
    if (!trimmedTitle) return addToast('請先輸入今天要完成的事情')
    if (!subject) return addToast('請先選擇任務科目')
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) return addToast('任務時間請填寫 1～600 分鐘')
    updateGame((current) => ({ ...current, tasks: [...current.tasks, { id: makeId('task'), title: trimmedTitle, subject, targetMinutes: minutes, progressMinutes: 0, completed: false, createdDate: today() }] }))
    addToast(`今日任務「${trimmedTitle}」已加入，完成對應科目讀書後可更新進度。`)
  }
  const confirmStudyTask = (id: string) => {
    const task = game.tasks.find((item) => item.id === id)
    const progress = task?.progressMinutes ?? (task?.completed ? task.targetMinutes : 0)
    if (!task || task.completed) return
    if (progress < task.targetMinutes) return addToast(`「${task.title}」還需要 ${task.targetMinutes - progress} 分鐘專注時間`)
    updateGame((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, progressMinutes: item.targetMinutes, completed: true } : item) }))
    addToast(`今日任務「${task.title}」已確認達成！`)
    playSound('claim', soundEnabled)
  }
  const deleteStudyTask = (id: string) => {
    const task = game.tasks.find((item) => item.id === id)
    if (!task || !window.confirm(`確定要刪除今日任務「${task.title}」嗎？`)) return
    updateGame((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== id) }))
    addToast('今日任務已刪除。')
  }
  const renamePlayer = (name: string) => updateGame((current) => ({ ...current, playerName: name }))
  const addSubject = () => {
    const name = newSubjectName.trim()
    if (!name) return addToast('請先輸入科目名稱')
    if (game.subjects.some((item) => item.name === name)) return addToast('這個科目已經存在')
    updateGame((current) => ({ ...current, subjects: [...current.subjects, { id: makeId('subject'), name, difficulty: newSubjectDifficulty, quality: newSubjectQuality, fruitTypeId: getFruitKind(name).id, source: 'user' }] }))
    setSelectedSubject(name)
    setNewSubjectName('')
    setShowAddSubject(false)
    addToast(`已新增「${name}」，完成後可獲得對應品質獎勵`)
  }
  const importMedicalYear = (year: 1 | 2 | 3 | 4) => {
    const courses = medicalRequiredCourses.filter((course) => course.year === year)
    updateGame((current) => {
      const importedSubjects = courses.map((course, index) => ({ id: course.id, name: course.name, ...getMedicalCourseProfile(course), year: course.year, semester: course.semester, credits: course.credits, fruitTypeId: getMedicalFruitTypeId(course, index), source: '長庚大學醫學系 115 學年度必選修科目表' }))
      const knownNames = new Set(current.subjects.map((subject) => subject.name))
      const newSubjects = importedSubjects.filter((subject) => !knownNames.has(subject.name))
      const fruits = fruitCatalog.map((template) => { const existing = current.fruitGarden.fruits.find((fruit) => fruit.id === template.id); return existing ? { ...template, progressMinutes: existing.progressMinutes, readyCount: existing.readyCount, totalHarvested: existing.totalHarvested } : { ...template } })
      return { ...current, subjects: [...current.subjects, ...newSubjects], fruitGarden: { fruits } }
    })
    addToast(`已套入醫學系大${year}課程，共 ${courses.length} 門必修，並建立對應靈果`)
  }
  const harvestFruit = (fruitId: string) => {
    const selectedFruit = game.fruitGarden.fruits.find((fruit) => fruit.id === fruitId)
    if (!selectedFruit || selectedFruit.readyCount === 0) return
    updateGame((current) => ({ ...current, spiritStones: current.spiritStones + selectedFruit.readyCount * 15, fruitGarden: { fruits: current.fruitGarden.fruits.map((fruit) => fruit.id === fruitId ? { ...fruit, totalHarvested: fruit.totalHarvested + fruit.readyCount, readyCount: 0 } : fruit) }, dailyTasks: addDailyProgress(current.dailyTasks, 'harvestFruit', selectedFruit.readyCount) }))
    addToast(`採收${selectedFruit.name}成功！獲得 ${selectedFruit.readyCount * 15} 顆靈石`)
  }
  const exploreWorld = (activity: string, minutes: number) => {
    const find = rareWorldFinds[Math.floor(Math.random() * rareWorldFinds.length)]
    let alreadyFound = false
    const stoneReward = 8 + Math.floor(minutes / 5)
    updateGame((current) => {
      const existingItem = current.collectionItems.find((item) => item.name === find.name)
      alreadyFound = Boolean(existingItem)
      const existingMaterial = current.materials.find((material) => material.name === find.material.name)
      return {
        ...current,
        spiritStones: current.spiritStones + (alreadyFound ? stoneReward : 30 + minutes),
        pet: { ...current.pet, energy: Math.max(15, current.pet.energy - Math.max(3, Math.round(minutes / 10))), mood: Math.min(100, current.pet.mood + 8) },
        collectionItems: existingItem
          ? current.collectionItems.map((item) => item.id === existingItem.id ? { ...item, quantity: item.quantity + 1 } : item)
          : [...current.collectionItems, { ...find, id: makeId('find'), foundAt: new Date().toISOString(), quantity: 1 }],
        materials: existingMaterial ? current.materials.map((material) => material.name === find.material.name ? { ...material, amount: material.amount + 1 } : material) : [...current.materials, { ...find.material, amount: 1 }],
        explorationSessions: [...current.explorationSessions, { id: makeId('explore'), activity, minutes, completedAt: new Date().toISOString() }],
        dailyTasks: addDailyProgress(current.dailyTasks, 'explore', 1),
      }
    })
    addToast(`${activity}完成！記錄 ${minutes} 分鐘，${alreadyFound ? `再次獲得「${find.name}」` : `發現${find.rarity}物品「${find.name}」`}，獲得 ${alreadyFound ? stoneReward : 30 + minutes} 顆靈石`)
    playSound('explore', soundEnabled)
  }
  const claimDailyTask = (taskId: string) => {
    const task = game.dailyTasks.find((item) => item.id === taskId)
    if (!task || task.claimed || task.progress < task.target) return
    updateGame((current) => ({ ...current, cultivationExp: current.cultivationExp + task.rewardExp, spiritStones: current.spiritStones + task.rewardStones, dailyTasks: current.dailyTasks.map((item) => item.id === taskId ? { ...item, claimed: true } : item) }))
    addToast(`每日任務「${task.title}」獎勵已領取！`)
    playSound('claim', soundEnabled)
  }
  const buyFurniture = (furnitureId: string) => {
    const furniture = furnitureCatalog.find((item) => item.id === furnitureId)
    const ownedFurniture = game.caveFurniture.find((item) => item.id === furnitureId)
    if (!furniture || !ownedFurniture) return
    if (game.spiritStones < furniture.cost) return addToast(`購買${furniture.name}還需要 ${furniture.cost - game.spiritStones} 顆靈石`)
    updateGame((current) => ({ ...current, spiritStones: current.spiritStones - furniture.cost, caveFurniture: current.caveFurniture.map((item) => item.id === furnitureId ? { ...item, owned: item.owned + 1 } : item), lifetimeStats: { ...current.lifetimeStats, furnitureCount: current.lifetimeStats.furnitureCount + 1 } }))
    addToast(`已將${furniture.name}收入洞府庫藏！`)
    playSound('claim', soundEnabled)
  }
  const toggleFurniturePlacement = (furnitureId: string) => {
    const furniture = game.caveFurniture.find((item) => item.id === furnitureId)
    if (!furniture || furniture.owned < 1) return
    updateGame((current) => ({ ...current, caveFurniture: current.caveFurniture.map((item) => item.id === furnitureId ? { ...item, placed: !item.placed } : item) }))
  }
  const claimAchievement = (achievementId: string) => {
    const definition = achievementCatalog.find((item) => item.id === achievementId)
    const achievement = game.achievements.find((item) => item.id === achievementId)
    if (!definition || !achievement || achievement.claimed || achievement.progress < definition.target) return
    updateGame((current) => ({ ...current, cultivationExp: current.cultivationExp + definition.rewardExp, spiritStones: current.spiritStones + definition.rewardStones, achievements: current.achievements.map((item) => item.id === achievementId ? { ...item, claimed: true } : item) }))
    addToast(`成就「${definition.title}」獎勵已領取！`)
    playSound('claim', soundEnabled)
  }
  const craftRecipe = (recipeId: string) => {
    const recipe = petRecipes.find((item) => item.id === recipeId)
    if (!recipe) return
    if (recipe.requirements.some((requirement) => (game.materials.find((material) => material.name === requirement.materialName)?.amount ?? 0) < requirement.amount)) return addToast('材料不足，去大世界探索看看吧！')
    updateGame((current) => ({ ...current, pet: { ...current.pet, ...(recipe.id === 'recipe-spirit-snack' ? { energy: Math.min(100, current.pet.energy + 12), intimacy: Math.min(100, current.pet.intimacy + 4) } : { mood: Math.min(100, current.pet.mood + 12), intimacy: Math.min(100, current.pet.intimacy + 8) }), combatStats: { attack: current.pet.combatStats.attack + (recipe.combatBoost?.attack ?? 0), defense: current.pet.combatStats.defense + (recipe.combatBoost?.defense ?? 0), spirit: current.pet.combatStats.spirit + (recipe.combatBoost?.spirit ?? 0), agility: current.pet.combatStats.agility + (recipe.combatBoost?.agility ?? 0) } }, materials: current.materials.map((material) => { const requirement = recipe.requirements.find((item) => item.materialName === material.name); return requirement ? { ...material, amount: material.amount - requirement.amount } : material }).filter((material) => material.amount > 0), lifetimeStats: { ...current.lifetimeStats, craftCount: current.lifetimeStats.craftCount + 1 } }))
    addToast(`製作完成：${recipe.name}，噗比獲得 ${recipe.effect}`)
    playSound('success', soundEnabled)
  }

  const totalExp = game.cultivationExp
  const availableRealmIndex = [...realmData].reverse().findIndex((realm) => totalExp >= realm.requirement)
  const highestRealmIndex = availableRealmIndex < 0 ? 0 : realmData.length - 1 - availableRealmIndex
  // Imported/cloud data can contain an out-of-range index. Keep the render
  // path safe so one malformed save cannot blank the whole app.
  const safeRealmIndex = Number.isFinite(game.realmIndex) ? Math.max(0, Math.min(realmData.length - 1, Math.floor(game.realmIndex))) : 0
  const breakthrough = () => {
    const nextRealmIndex = safeRealmIndex + 1
    const nextRealm = realmData[nextRealmIndex]
    if (!nextRealm || totalExp < nextRealm.requirement) return addToast(`還需要 ${Math.max(nextRealm?.requirement - totalExp, 0)} 點修為才能突破`)
    const rewardStones = 100 + nextRealmIndex * 80
    updateGame((current) => ({ ...current, realmIndex: nextRealmIndex, spiritStones: current.spiritStones + rewardStones, pet: { ...current.pet, mood: Math.min(100, current.pet.mood + 15), intimacy: Math.min(100, current.pet.intimacy + 5) }, breakthroughs: [...current.breakthroughs, { id: makeId('breakthrough'), realmIndex: nextRealmIndex, completedAt: new Date().toISOString(), rewardStones }] }))
    addToast(`突破${nextRealm.name} · ${nextRealm.phase}成功！獲得 ${rewardStones} 顆靈石，噗比也感受到你的氣勢了。`)
    playSound('breakthrough', soundEnabled)
  }

  const realmIndex = Math.min(safeRealmIndex, highestRealmIndex)
  const currentRealm = realmData[realmIndex]
  const nextRealm = realmData[realmIndex + 1]
  const filteredTasks = useMemo(() => game.tasks.filter((task) => filter === '全部' || task.subject === filter), [filter, game.tasks])

  return <Layout activeView={activeView} onNavigate={setActiveView} playerName={game.playerName} onPlayerNameChange={renamePlayer} pet={game.pet} notice={toast} soundEnabled={soundEnabled} onSoundToggle={toggleSound} onExportSave={exportSave} onImportSave={importSave} onResetSave={resetSave} cloudSession={cloudSession} cloudStatus={cloudStatus} onCloudSignIn={handleCloudSignIn} onCloudSignUp={handleCloudSignUp} onCloudSignOut={handleCloudSignOut} onCloudUpload={uploadCloudSave} onCloudDownload={downloadCloudSave}>
    {activeView === 'home' && <HomeView game={game} currentRealm={currentRealm} onStart={() => setShowTimer(true)} onFeed={feedPet} onPlay={playWithPet} onHarvestFruit={harvestFruit} onExplore={exploreWorld} onClaimTask={claimDailyTask} interactionAvailable={interactionAvailable} interactionLabel={`下次 ${interactionSlot.nextReset}`} />}
    {activeView === 'study' && <StudyView game={game} selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject} showTimer={showTimer} setShowTimer={setShowTimer} onComplete={handleComplete} filter={filter} setFilter={setFilter} tasks={filteredTasks} onAddTask={addStudyTask} onConfirmTask={confirmStudyTask} onDeleteTask={deleteStudyTask} showAddSubject={showAddSubject} setShowAddSubject={setShowAddSubject} newSubjectName={newSubjectName} setNewSubjectName={setNewSubjectName} newSubjectDifficulty={newSubjectDifficulty} setNewSubjectDifficulty={setNewSubjectDifficulty} newSubjectQuality={newSubjectQuality} setNewSubjectQuality={setNewSubjectQuality} addSubject={addSubject} />}
    {activeView === 'cultivation' && <CultivationView game={game} currentRealm={currentRealm} nextRealm={nextRealm} totalExp={totalExp} realmIndex={realmIndex} canBreakthrough={safeRealmIndex < highestRealmIndex} onBreakthrough={breakthrough} />}
    {activeView === 'cave' && <CaveView game={game} onHarvestFruit={harvestFruit} onCraft={craftRecipe} onImportMedicalYear={importMedicalYear} onStart={() => setActiveView('study')} onBuyFurniture={buyFurniture} onToggleFurniture={toggleFurniturePlacement} />}
    {activeView === 'collection' && <CollectionView game={game} onExplore={exploreWorld} onClaimAchievement={claimAchievement} />}
    {toast && <div className="toast toast-enter" role="status" aria-live="polite"><span>✦</span>{toast}</div>}
  </Layout>
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function HomeView({ game, currentRealm, onStart, onFeed, onPlay, onHarvestFruit, onExplore, onClaimTask, interactionAvailable, interactionLabel }: { game: GameState; currentRealm: typeof realmData[number]; onStart: () => void; onFeed: (fruitId: string) => void; onPlay: () => void; onHarvestFruit: (fruitId: string) => void; onExplore: (activity: string, minutes: number) => void; onClaimTask: (taskId: string) => void; interactionAvailable: boolean; interactionLabel: string }) {
  return <><PageHeader eyebrow={`晨安，${game.playerName}`} title="今日也要穩穩修煉" description="讓每一次專注，都成為噗比的靈氣。" action={<button className="primary-button" onClick={onStart}>開始今日伴讀 <span>✦</span></button>} /><div className="home-grid"><PetCard pet={game.pet} realmName={`${currentRealm.name} · ${currentRealm.phase}`} garden={game.fruitGarden} onFeed={onFeed} onPlay={onPlay} interactionAvailable={interactionAvailable} interactionLabel={interactionLabel} /><ProgressCard sessions={game.sessions} dailyGoal={game.dailyGoal} pet={game.pet} /><DailyTasksCard tasks={game.dailyTasks} onClaim={onClaimTask} /><FruitGardenCard garden={game.fruitGarden} onHarvest={onHarvestFruit} /><WorldExploreCard onExplore={onExplore} totalMinutes={game.explorationSessions.reduce((sum, session) => sum + session.minutes, 0)} /></div></>
}

function LegacyStudyView({ game, selectedSubject, setSelectedSubject, showTimer, setShowTimer, onComplete, filter, setFilter, tasks, toggleTask, addToast, showAddSubject, setShowAddSubject, newSubjectName, setNewSubjectName, newSubjectDifficulty, setNewSubjectDifficulty, newSubjectQuality, setNewSubjectQuality, addSubject }: { game: GameState; selectedSubject: string; setSelectedSubject: (value: string) => void; showTimer: boolean; setShowTimer: (value: boolean) => void; onComplete: (minutes: number, subject: string) => void; filter: Subject; setFilter: (value: Subject) => void; tasks: GameState['tasks']; toggleTask: (id: string) => void; addToast: (message: string) => void; showAddSubject: boolean; setShowAddSubject: (value: boolean) => void; newSubjectName: string; setNewSubjectName: (value: string) => void; newSubjectDifficulty: SubjectDifficulty; setNewSubjectDifficulty: (value: SubjectDifficulty) => void; newSubjectQuality: SubjectQuality; setNewSubjectQuality: (value: SubjectQuality) => void; addSubject: () => void }) {
  const filterSubjects = ['全部', ...game.subjects.map((item) => item.name)]
  const now = new Date()
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六']
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekMinutes = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const key = localDateKey(date)
    return game.sessions.filter((session) => session.completedAt.slice(0, 10) === key).reduce((sum, session) => sum + session.minutes, 0)
  })
  return <><PageHeader eyebrow="伴讀修煉" title="把專注變成修為" description="選一個科目，讓噗比陪你完成今天的學習目標。" action={<button className="primary-button" onClick={() => setShowTimer(true)}>開始計時 <span>◷</span></button>} /><div className="study-layout"><section className="card study-overview"><div className="card-heading"><div><span className="eyebrow">本週修煉紀錄</span><h2>循序漸進，自有所得</h2></div><span className="week-total">{game.sessions.reduce((sum, session) => sum + session.minutes, 0)} 分鐘</span></div><div className="week-bars">{['一', '二', '三', '四', '五', '六', '日'].map((day, index) => { const height = [45, 72, 32, 88, 62, 18, 0][index]; return <div className="week-bar" key={day}><div className="bar-track"><span style={{ height: `${height}%` }} /></div><small>{day}</small></div> })}</div><div className="study-legend"><span><i className="legend-dot mint" />專注時間</span><span>目標 {game.dailyGoal} 分鐘／日</span></div></section><section className="card task-card"><div className="card-heading"><div><span className="eyebrow">修煉功課</span><h2>今日任務</h2></div><button className="text-button" onClick={() => setShowAddSubject(!showAddSubject)}>＋ 自訂科目</button></div>{showAddSubject && <div className="add-subject-form"><input value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="例如：日文、吉他、閱讀" maxLength={18} /><div><select value={newSubjectDifficulty} onChange={(event) => setNewSubjectDifficulty(event.target.value as SubjectDifficulty)}>{difficultyOptions.map((item) => <option key={item}>{item}</option>)}</select><select value={newSubjectQuality} onChange={(event) => setNewSubjectQuality(event.target.value as SubjectQuality)}>{qualityOptions.map((item) => <option key={item}>{item}</option>)}</select><button className="soft-button" onClick={addSubject}>加入科目</button></div><small>難度與品質會影響完成讀書後的修為、靈石獎勵。</small></div>}<div className="filter-row">{filterSubjects.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="task-list">{tasks.map((task) => <button className={`task-item ${task.completed ? 'completed' : ''}`} key={task.id} onClick={() => toggleTask(task.id)}><span className="check-circle">{task.completed ? '✓' : ''}</span><span className="task-copy"><strong>{task.title}</strong><small>{task.subject} · {task.targetMinutes} 分鐘</small></span><span className="task-arrow">→</span></button>)}</div></section><section className="card history-card"><div className="card-heading"><div><span className="eyebrow">最近入定</span><h2>學習紀錄</h2></div><span className="history-count">{game.sessions.length} 次</span></div><div className="history-list">{[...game.sessions].reverse().slice(0, 5).map((session) => <div className="history-item" key={session.id}><span className="history-icon">✧</span><div><strong>{session.subject}專注修煉</strong><small>{session.difficulty} · {session.quality} · {new Date(session.completedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}</small></div><b>+{session.rewardExp ?? session.minutes * 10} 修為</b></div>)}</div></section></div>{showTimer && <div className="modal-backdrop"><div className="timer-modal"><button className="modal-close" onClick={() => setShowTimer(false)}>×</button><StudyTimer subject={selectedSubject} subjectCatalog={game.subjects} onSubjectChange={setSelectedSubject} onComplete={onComplete} onCancel={() => setShowTimer(false)} /></div></div>}</>
}

function CultivationView({ game, currentRealm, nextRealm, totalExp, realmIndex, canBreakthrough, onBreakthrough }: { game: GameState; currentRealm: typeof realmData[number]; nextRealm?: typeof realmData[number]; totalExp: number; realmIndex: number; canBreakthrough: boolean; onBreakthrough: () => void }) {
  const toNext = nextRealm ? Math.max(nextRealm.requirement - totalExp, 0) : 0
  const percent = nextRealm ? Math.min((totalExp - currentRealm.requirement) / (nextRealm.requirement - currentRealm.requirement) * 100, 100) : 100
  return <>
    <PageHeader eyebrow="修仙大道" title="境界，始於每一次專注" description="累積修為經驗，突破境界，解鎖更多洞府機緣。" action={<div className="currency-chip">✧ {game.spiritStones.toLocaleString()} <small>靈石</small></div>} />
    <div className="cultivation-layout">
      <section className="card cultivation-hero">
        <div className="hero-glow">✦</div>
        <span className="eyebrow">當前境界 · 第 {realmIndex + 1} 階</span>
        <h2>{currentRealm.name} · {currentRealm.phase}</h2>
        <p>{currentRealm.subtitle}</p>
        <div className="big-exp"><strong>{totalExp.toLocaleString()}</strong><span>總修為</span></div>
        <div className="cultivation-progress"><span style={{ width: `${percent}%` }} /></div>
        <div className="cultivation-progress-label"><span>距離突破還需 {toNext.toLocaleString()} 修為</span><span>{Math.round(percent)}%</span></div>
        <button className={`primary-button ${canBreakthrough ? '' : 'disabled-button'}`} onClick={onBreakthrough} disabled={!canBreakthrough}>{canBreakthrough ? `突破至${nextRealm?.name} · ${nextRealm?.phase}` : nextRealm ? '尚未滿足突破條件' : '境界已臻圓滿'} <span>✦</span></button>
        <p className="breakthrough-reward">突破成功可獲得靈石與噗比的心情、親密度加成。</p>
      </section>
      <section className="card realm-road">
        <div className="card-heading"><div><span className="eyebrow">修煉路徑</span><h2>六大境界</h2></div><span className="road-count">{realmIndex + 1} / {realmData.length}</span></div>
        <div className="road-list">{realmData.map((realm, index) => <div className={`road-item ${index === realmIndex ? 'current' : ''} ${index < realmIndex ? 'passed' : ''}`} key={`${realm.name}-${realm.phase}`}><span className="road-node">{index < realmIndex ? '✓' : index === realmIndex ? '✦' : '·'}</span><div><strong>{realm.name} · {realm.phase}</strong><small>{realm.subtitle} · {realm.requirement.toLocaleString()} 修為</small></div>{index === realmIndex && <span className="current-label">目前</span>}</div>)}</div>
        {game.breakthroughs.length > 0 && <div className="breakthrough-history">已完成 {game.breakthroughs.length} 次突破 · 最近一次 {new Date(game.breakthroughs[game.breakthroughs.length - 1].completedAt).toLocaleDateString('zh-TW')}</div>}
      </section>
    </div>
  </>
}

function CaveView({ game, onHarvestFruit, onCraft, onImportMedicalYear, onStart, onBuyFurniture, onToggleFurniture }: { game: GameState; onHarvestFruit: (fruitId: string) => void; onCraft: (recipeId: string) => void; onImportMedicalYear: (year: 1 | 2 | 3 | 4) => void; onStart: () => void; onBuyFurniture: (id: string) => void; onToggleFurniture: (id: string) => void }) {
  const [selectedMedicalYear, setSelectedMedicalYear] = useState<1 | 2 | 3 | 4>(1)
  return <><PageHeader eyebrow="洞府管理" title="靈植園與煉製台" description="讀書培育五種靈果，探索收集材料，再製作協助噗比成長的物品。" action={<button className="primary-button" onClick={onStart}>前往伴讀 <span>◷</span></button>} /><div className="cave-layout">
    <section className="card medical-import-card"><div className="card-heading"><div><span className="eyebrow">醫學系課程匯入</span><h2>快速套入必修科目</h2></div><span className="medical-mark">✚</span></div><p className="medical-intro">選擇年級後匯入長庚醫學系必修；課程內容已整合到伴讀科目，不在洞府佔用版面。</p><div className="year-tabs">{([1, 2, 3, 4] as const).map((year) => <button key={year} className={selectedMedicalYear === year ? 'active' : ''} onClick={() => setSelectedMedicalYear(year)}>大{year}</button>)}</div><button className="primary-button import-year-button" onClick={() => onImportMedicalYear(selectedMedicalYear)}>匯入大{selectedMedicalYear}必修科目 <span>✦</span></button><small className="source-note">資料來源：長庚大學醫學系 115 學年度必選修科目表</small></section>
    <FruitGardenCard garden={game.fruitGarden} onHarvest={onHarvestFruit} />
    <section className="card crafting-card"><div className="card-heading"><div><span className="eyebrow">煉製台</span><h2>靈寵成長配方</h2></div><span className="craft-icon">✦</span></div><p className="craft-intro">材料來自大世界探索；配方也能提升噗比的戰鬥屬性。</p><div className="material-row"><span>手上材料</span>{game.materials.length === 0 ? <small>尚無材料，先去藏寶閣探索</small> : game.materials.map((material) => <b key={material.name}>{material.icon} {material.name} ×{material.amount}</b>)}</div><div className="recipe-list">{petRecipes.map((recipe) => <div className="recipe-item" key={recipe.id}><span className="recipe-icon">{recipe.icon}</span><div className="recipe-copy"><strong>{recipe.name}</strong><small>{recipe.description}</small><em>{recipe.requirements.map((requirement) => `${requirement.materialName} ×${requirement.amount}`).join(' ＋ ')} · {recipe.effect}</em></div><button className="soft-button" onClick={() => onCraft(recipe.id)}>製作</button></div>)}</div></section>
    <section className="card cave-preview"><span className="eyebrow">洞府一隅</span><h2>一畝靈田，慢慢養成</h2><div className="cave-art"><span>☁</span><b>🌱</b><i>✦</i>{game.caveFurniture.filter((item) => item.placed).slice(0, 3).map((item, index) => <strong className={`placed-furniture placed-furniture-${index}`} key={item.id}>{item.icon}</strong>)}</div><p>五種靈果會依讀書科目與專注時間成長；擺入家具，讓洞府成為專屬的修煉空間。</p><div className="locked-features"><span>✦ 已擺放 {game.caveFurniture.filter((item) => item.placed).length} 件家具</span><span>▧ 靈植圖鑑</span><span>✦ 更多配方</span></div></section>
    <CaveFurniturePanel furniture={game.caveFurniture} spiritStones={game.spiritStones} onBuy={onBuyFurniture} onTogglePlacement={onToggleFurniture} />
    <InventoryPanel materials={game.materials} fruitGarden={game.fruitGarden} collectionItems={game.collectionItems} />
  </div></>
}
function CollectionView({ game, onExplore, onClaimAchievement }: { game: GameState; onExplore: (activity: string, minutes: number) => void; onClaimAchievement: (id: string) => void }) {
  const totalCount = game.collectionItems.reduce((sum, item) => sum + item.quantity, 0)
  return <><PageHeader eyebrow="藏寶閣" title="把大世界帶回洞府" description="運動、散步與休閒娛樂都能成為探索，完成探索時長後獲得圖鑑物品與獎勵。" action={<span className="currency-chip">✧ {game.spiritStones.toLocaleString()} <small>靈石</small></span>} /><div className="collection-layout"><WorldExploreCard onExplore={onExplore} /><section className="card collection-card"><div className="card-heading"><div><span className="eyebrow">探索圖鑑</span><h2>已獲得 {totalCount} 件奇珍</h2></div><span className="collection-count">{game.collectionItems.length} / {rareWorldFinds.length} 種</span></div>{game.collectionItems.length === 0 ? <div className="empty-collection"><span>◇</span><p>還沒有發現物品。<br />選一項休閒活動並完成計時吧。</p></div> : <div className="collection-grid">{game.collectionItems.map((item) => <div className={`collection-item rarity-${item.rarity}`} key={item.id}><span className="collection-icon">{item.icon}</span><strong>{item.name}</strong><small>{item.rarity} · 已獲得 ×{item.quantity} · {item.description}</small></div>)}</div>}</section><AchievementPanel achievements={game.achievements} onClaim={onClaimAchievement} /><StatisticsPanel game={game} /></div></>
}
function PlaceholderView({ icon, eyebrow, title, text, action, onAction }: { icon: string; eyebrow: string; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="placeholder-wrap"><div className="placeholder-orbit"><span>{icon}</span></div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p><button className="primary-button" onClick={onAction}>{action} <span>→</span></button><div className="coming-soon">PHASE 2 · COMING SOON</div></div>
}

function StudyView({ game, selectedSubject, setSelectedSubject, showTimer, setShowTimer, onComplete, filter, setFilter, tasks, onAddTask, onConfirmTask, onDeleteTask, showAddSubject, setShowAddSubject, newSubjectName, setNewSubjectName, newSubjectDifficulty, setNewSubjectDifficulty, newSubjectQuality, setNewSubjectQuality, addSubject }: { game: GameState; selectedSubject: string; setSelectedSubject: (value: string) => void; showTimer: boolean; setShowTimer: (value: boolean) => void; onComplete: (minutes: number, subject: string) => void; filter: Subject; setFilter: (value: Subject) => void; tasks: GameState['tasks']; onAddTask: (title: string, subject: string, targetMinutes: number) => void; onConfirmTask: (id: string) => void; onDeleteTask: (id: string) => void; showAddSubject: boolean; setShowAddSubject: (value: boolean) => void; newSubjectName: string; setNewSubjectName: (value: string) => void; newSubjectDifficulty: SubjectDifficulty; setNewSubjectDifficulty: (value: SubjectDifficulty) => void; newSubjectQuality: SubjectQuality; setNewSubjectQuality: (value: SubjectQuality) => void; addSubject: () => void }) {
  const filterSubjects = ['全部', ...game.subjects.map((item) => item.name)]
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六']
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekMinutes = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    const key = dateKey(day)
    return game.sessions.filter((session) => dateKey(new Date(session.completedAt)) === key).reduce((sum, session) => sum + session.minutes, 0)
  })
  const weekTotal = weekMinutes.reduce((sum, minutes) => sum + minutes, 0)
  const weekGoal = game.dailyGoal * 7
  const weekPercent = Math.min(weekTotal / Math.max(weekGoal, 1) * 100, 100)
  const completedDays = weekMinutes.filter((minutes) => minutes >= game.dailyGoal).length
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskSubject, setNewTaskSubject] = useState(game.subjects[0]?.name ?? '')
  const [newTaskMinutes, setNewTaskMinutes] = useState('25')
  useEffect(() => {
    if (!game.subjects.some((subject) => subject.name === newTaskSubject)) setNewTaskSubject(game.subjects[0]?.name ?? '')
  }, [game.subjects, newTaskSubject])
  const submitStudyTask = (event: FormEvent) => {
    event.preventDefault()
    onAddTask(newTaskTitle, newTaskSubject, Number(newTaskMinutes))
    if (newTaskTitle.trim() && Number(newTaskMinutes) >= 1) {
      setNewTaskTitle('')
      setNewTaskMinutes('25')
      setShowAddTask(false)
    }
  }
  return <>
    <PageHeader eyebrow="伴讀修煉" title="把專注變成修為" description="選一個科目，讓噗比陪你完成今天的學習目標。" action={<button className="primary-button" onClick={() => setShowTimer(true)}>開始計時 <span>◷</span></button>} />
    <div className="study-layout">
      <section className="card study-overview">
        <div className="card-heading"><div><span className="eyebrow">本週修煉紀錄</span><h2>循序漸進，自有所得</h2></div><span className="week-total">{weekTotal} / {weekGoal} 分鐘</span></div>
        <div className="week-bars">{weekMinutes.map((minutes, index) => { const day = new Date(weekStart); day.setDate(weekStart.getDate() + index); const height = Math.min(minutes / Math.max(game.dailyGoal, 1) * 100, 100); const isToday = dateKey(day) === dateKey(new Date()); return <div className={`week-bar ${isToday ? 'today' : ''}`} key={dateKey(day)} title={`${dateKey(day)}：${minutes} 分鐘`}><div className="bar-track"><span style={{ height: `${height}%` }} /></div><small>{dayLabels[day.getDay()]}</small><em>{minutes}分</em></div> })}</div>
        <div className="weekly-progress-summary"><div><small>本週目標完成度</small><strong>{Math.round(weekPercent)}%</strong></div><div><small>達成每日目標</small><strong>{completedDays} / 7 天</strong></div><div className="weekly-progress-track"><span style={{ width: `${weekPercent}%` }} /></div></div>
        <div className="study-legend"><span><i className="legend-dot mint" />每日實際專注</span><span>每日目標 {game.dailyGoal} 分鐘</span></div>
      </section>
      <section className="card task-card">
        <div className="card-heading"><div><span className="eyebrow">修煉功課</span><h2>今日任務</h2></div><div className="task-card-actions"><button className="text-button" onClick={() => setShowAddTask((current) => !current)}>＋ 新增任務</button><button className="text-button" onClick={() => setShowAddSubject(!showAddSubject)}>＋ 自訂科目</button></div></div>
        <p className="task-help">輸入今天想完成的事情；選定科目的讀書計時會自動累積進度，達標後再由你確認完成。</p>
        {showAddTask && <form className="daily-task-form" onSubmit={submitStudyTask}><input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="例如：整理病理學筆記" maxLength={40} autoFocus /><div><select value={newTaskSubject} onChange={(event) => setNewTaskSubject(event.target.value)}>{game.subjects.length === 0 ? <option value="">請先新增科目</option> : game.subjects.map((subject) => <option key={subject.id} value={subject.name}>{subject.name}</option>)}</select><input type="number" min="1" max="600" value={newTaskMinutes} onChange={(event) => setNewTaskMinutes(event.target.value)} aria-label="任務需要的讀書分鐘" /><span>分鐘</span><button className="soft-button" type="submit">加入今日任務</button></div><small>只有相同科目的完成讀書時間會計入這項任務。</small></form>}
        {showAddSubject && <div className="add-subject-form"><input value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="例如：日文、吉他、閱讀" maxLength={18} /><div><select value={newSubjectDifficulty} onChange={(event) => setNewSubjectDifficulty(event.target.value as SubjectDifficulty)}>{difficultyOptions.map((item) => <option key={item}>{item}</option>)}</select><select value={newSubjectQuality} onChange={(event) => setNewSubjectQuality(event.target.value as SubjectQuality)}>{qualityOptions.map((item) => <option key={item}>{item}</option>)}</select><button className="soft-button" onClick={addSubject}>加入科目</button></div><small>難度與品質會影響完成讀書後的修為、靈石獎勵。</small></div>}
        <div className="filter-row">{filterSubjects.map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <div className="task-list">{tasks.length === 0 ? <p className="task-empty">今天還沒有任務，按右上角「新增任務」開始安排。</p> : tasks.map((task) => { const progress = Math.min(task.progressMinutes ?? (task.completed ? task.targetMinutes : 0), task.targetMinutes); const ready = progress >= task.targetMinutes; return <div className={`task-item ${task.completed ? 'completed' : ''}`} key={task.id}><span className="check-circle">{task.completed ? '✓' : ready ? '✦' : ''}</span><span className="task-copy"><strong>{task.title}</strong><small>{task.subject} · {progress} / {task.targetMinutes} 分鐘</small><span className="study-task-track"><span style={{ width: `${progress / task.targetMinutes * 100}%` }} /></span></span><span className="task-actions"><button className="task-confirm-button" type="button" disabled={!ready || task.completed} onClick={() => onConfirmTask(task.id)}>{task.completed ? '已確認' : ready ? '確認達成' : '讀書累積'}</button><button className="task-delete-button" type="button" onClick={() => onDeleteTask(task.id)} aria-label={`刪除任務 ${task.title}`}>刪除</button></span></div> })}</div>
      </section>
      <section className="card history-card"><div className="card-heading"><div><span className="eyebrow">最近入定</span><h2>學習紀錄</h2></div><span className="history-count">{game.sessions.length} 次</span></div><div className="history-list">{[...game.sessions].reverse().slice(0, 5).map((session) => <div className="history-item" key={session.id}><span className="history-icon">✧</span><div><strong>{session.subject}專注修煉</strong><small>{session.difficulty} · {session.quality} · {new Date(session.completedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}</small></div><b>+{session.rewardExp ?? session.minutes * 10} 修為</b></div>)}</div></section>
    </div>
    {showTimer && <div className="modal-backdrop"><div className="timer-modal"><button className="modal-close" onClick={() => setShowTimer(false)}>×</button><StudyTimer subject={selectedSubject} subjectCatalog={game.subjects} onSubjectChange={setSelectedSubject} onComplete={onComplete} onCancel={() => setShowTimer(false)} /></div></div>}
  </>
}

export default App
