/**
 * Calendar-aware date helpers used for planning duration previews.
 *
 * These mirror the authoritative logic in `backend/app/utils/dates.py` so the
 * frontend can preview an end date before the backend computes the real one.
 * The backend remains the single source of truth for stored dates.
 */

function clampDay(year: number, monthIndex: number, day: number) {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(day, lastDayOfMonth)
}

/** Add whole calendar months to a `yyyy-mm-dd` date string (local calendar math). */
export function addMonths(date: string, months: number): string {
  if (months < 0 || !date) return date
  const [year, month, day] = date.split("-").map(Number)
  if (!year || !month || !day) return date
  const total = year * 12 + (month - 1) + months
  const targetYear = Math.floor(total / 12)
  const targetMonth = (total % 12) + 1
  const targetDay = clampDay(targetYear, targetMonth - 1, day)
  const paddedMonth = String(targetMonth).padStart(2, "0")
  const paddedDay = String(targetDay).padStart(2, "0")
  return `${targetYear}-${paddedMonth}-${paddedDay}`
}

/** End date (`yyyy-mm-dd`) of a plan that starts on `startDate` and lasts `durationMonths`. */
export function endDateFromDuration(startDate: string, durationMonths: number): string {
  if (!durationMonths || durationMonths < 1 || !startDate) return ""
  return addMonths(startDate, durationMonths)
}

/** Present a fractional month count as a friendly label (e.g. 1, 3, 6, 12). */
export function formatDurationMonths(months: number | null | undefined): string {
  if (!months) return "—"
  return months === 1 ? "1 month" : `${months} months`
}

export const DURATION_PRESETS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
] as const

/** Today's calendar date as a `yyyy-mm-dd` string (local time). */
export function startOfTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** True when a `yyyy-mm-dd` date is strictly before today. */
export function isPastDate(dateString: string): boolean {
  if (!dateString) return true
  return dateString < startOfTodayDateString()
}

/** True when an ISO start-date has already passed (the plan has started). */
export function planHasStarted(startDateIso: string | undefined | null): boolean {
  if (!startDateIso) return false
  return startDateIso.slice(0, 10) < startOfTodayDateString()
}