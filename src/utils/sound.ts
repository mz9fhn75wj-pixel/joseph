export type SoundEffect = 'success' | 'feed' | 'explore' | 'claim' | 'breakthrough' | 'click'

const SOUND_KEY = 'cultivation-companion-sound-enabled-v1'
let audioContext: AudioContext | null = null

export function readSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!audioContext && AudioContextConstructor) audioContext = new AudioContextConstructor()
  if (!audioContext) throw new Error('Web Audio API unavailable')
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

const tones: Record<SoundEffect, number[]> = {
  success: [523.25, 659.25, 783.99],
  feed: [392, 523.25],
  explore: [329.63, 440, 659.25],
  claim: [587.33, 739.99, 880],
  breakthrough: [261.63, 392, 523.25, 783.99],
  click: [440],
}

export function playSound(effect: SoundEffect, enabled = readSoundEnabled()) {
  if (!enabled || typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) return
  try {
    const context = getAudioContext()
    const now = context.currentTime
    tones[effect].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = now + index * 0.075
      oscillator.type = effect === 'breakthrough' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(effect === 'click' ? 0.035 : 0.07, start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (effect === 'breakthrough' ? 0.36 : 0.22))
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.4)
    })
  } catch {
    // Sound is an enhancement; unsupported or blocked audio should not affect gameplay.
  }
}
