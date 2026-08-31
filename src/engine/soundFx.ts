/**
 * Web Audio API Sound FX — TypeScript
 */

const STORAGE_SOUND_KEY = 'hiroto_sound_enabled'

export class SoundFx {
  private ctx: AudioContext | null = null
  enabled: boolean = true

  constructor() {
    const saved = localStorage.getItem(STORAGE_SOUND_KEY)
    this.enabled = saved !== null ? saved === 'true' : true
  }

  private _init(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) this.ctx = new AudioCtx()
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  toggle(): boolean {
    this.enabled = !this.enabled
    localStorage.setItem(STORAGE_SOUND_KEY, String(this.enabled))
    return this.enabled
  }

  playTick(): void {
    if (!this.enabled) return
    this._init()
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)
    gain.gain.setValueAtTime(0.04, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(now)
    osc.stop(now + 0.08)
  }

  unlockAudioContext(): void {
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }
}
