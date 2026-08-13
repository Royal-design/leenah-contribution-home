let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) {
    return null
  }
  if (!audioContext) {
    audioContext = new Ctor()
  }
  return audioContext
}

/**
 * Plays a short two-note chime using WebAudio (no audio asset required).
 * Safe to call from any notification handler; no-ops if audio is unavailable.
 */
export function playNotificationSound() {
  try {
    const ctx = getContext()
    if (!ctx) {
      return
    }
    if (ctx.state === "suspended") {
      void ctx.resume()
    }
    const now = ctx.currentTime
    const notes = [880, 1318.52]
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = now + index * 0.16
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.5)
    })
  } catch {
    // Audio is best-effort — never break the notification flow.
  }
}
