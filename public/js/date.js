export function todayLocal() {
  return new Date().toLocaleDateString("en-CA")
}

export function shiftIsoDate(iso, days) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatDisplayDate(iso) {
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}

export function weekStart(iso) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date.toISOString().slice(0, 10)
}

export function formatTime(value, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value))
}

export function formatMinutes(total) {
  const minutes = Math.max(0, Number(total) || 0)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function isUnlockTokenFresh(token) {
  if (typeof token !== "string") return false
  try {
    const base64 = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}
