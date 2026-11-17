// Monday-first calendar; date keys use Shanghai's civil day, independent of host timezone.
export function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}
export function monthCells(year: number, month: number) {
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return [
    ...Array(offset).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    )
  ] as (string | null)[]
}
