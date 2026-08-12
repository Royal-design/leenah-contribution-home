export const TODAY = new Date(2026, 7, 12)

export function daysFromNow(days: number) {
  return addDays(TODAY, days)
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

export function iso(date: Date) {
  return date.toISOString()
}