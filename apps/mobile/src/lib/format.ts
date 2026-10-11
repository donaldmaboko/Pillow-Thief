import { formatMoney, money, type Money } from '@pillow-thief/shared'
import { APP_TIMEZONE } from './config'

/** Format minor units (thebe) for display. */
export function fmtMoney(minor: number, currency = 'BWP'): string {
  return formatMoney(money(minor, currency) satisfies Money)
}

/** Format a UTC ISO timestamp in Africa/Gaborone for display. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('en-BW', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(d)
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('en-BW', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  }).format(d)
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('en-BW', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(d)
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Minutes-of-day -> "HH:mm" in 24h local time. */
export function minutesToHHmm(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}
