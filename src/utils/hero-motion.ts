export interface SpringState {
  position: number
  velocity: number
}
export function springStep(state: SpringState, target: number, seconds: number): SpringState {
  const dt = Math.max(0, Math.min(seconds, 1 / 30))
  const velocity = (state.velocity + (target - state.position) * 190 * dt) * Math.exp(-19 * dt)
  return { position: state.position + velocity * dt, velocity }
}
export function fadeProgress(value: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}
