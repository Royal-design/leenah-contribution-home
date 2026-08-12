const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const compactFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatNaira(amount: number) {
  return nairaFormatter.format(amount)
}

export function formatNairaCompact(amount: number) {
  return compactFormatter.format(amount)
}

export function formatWithSign(amount: number) {
  const formatted = nairaFormatter.format(Math.abs(amount))
  return amount < 0 ? `-${formatted}` : formatted
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatLongDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function formatMonthYear(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  })
}

export function formatShortMonth(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NG", { month: "short" })
}

export function daysUntil(date: string | Date) {
  const target = new Date(date)
  const today = startOfDay(new Date())
  const diff = Math.round((startOfDay(target).getTime() - today.getTime()) / 86_400_000)
  return diff
}

export function relativeDate(date: string | Date) {
  const diff = daysUntil(date)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  if (diff > 1) return `in ${diff} days`
  return `${Math.abs(diff)} days ago`
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function formatRelativeTime(iso: string) {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function getInitials(firstName: string, lastName?: string) {
  if (lastName) return initials(`${firstName} ${lastName}`)
  return initials(firstName)
}