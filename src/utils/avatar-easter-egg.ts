export const FOCUS_URL = '/yen-chiu-astro/verify/'

// Count a deliberate burst of taps, rather than ordinary clicks across a visit.
export function createAvatarTapCounter() {
  let count = 0
  let previous = -Infinity
  return (now: number) => {
    count = now - previous <= 1500 ? count + 1 : 1
    previous = now
    if (count < 5) return false
    count = 0
    return true
  }
}
