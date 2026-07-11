import type { CompareStatus } from '@/types/fluidVerify'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume()
  }
  return audioContext
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume: number,
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

/** 도미 — 일치 알림 (도·미 2음) */
export function playDomisol(): void {
  const ctx = getAudioContext()
  const notes = [523.25, 659.25] // C5(도), E5(미)
  const start = ctx.currentTime

  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const noteStart = start + index * 0.14

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, noteStart)
    gain.gain.exponentialRampToValueAtTime(0.28, noteStart + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.32)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + 0.35)
  })
}

/** 삑삑삑삑 — 불일치·경고 알림 */
export function playBangBang(): void {
  const ctx = getAudioContext()
  const start = ctx.currentTime

  ;[0, 0.16, 0.32, 0.48].forEach((offset) => {
    playTone(ctx, 920, start + offset, 0.1, 'square', 0.38)
  })
}

export function playCompareResult(matched: boolean): void {
  if (matched) playDomisol()
  else playBangBang()
}

export function playVerificationResult(status: CompareStatus): void {
  if (status === 'match') {
    playDomisol()
  } else if (status === 'mismatch' || status === 'expired' || status === 'invalid_checkdigit') {
    playBangBang()
  }
}

export function isMismatchStatus(status: CompareStatus): boolean {
  return status === 'mismatch' || status === 'expired' || status === 'invalid_checkdigit'
}
