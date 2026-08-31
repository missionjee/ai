/**
 * Period calculation helpers — TypeScript port
 */

export const PeriodHelper = {
  generateFallbackPeriod(date: Date = new Date()): string {
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
    const minutes = Math.floor((date.getTime() - midnight.getTime()) / 60000)
    const counter = 10000 + minutes
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}${m}${d}1000${counter}`
  },

  getNextPeriod(issueNumber: string): string {
    if (!issueNumber) return ''
    const s = String(issueNumber).trim()
    if (s.length >= 17) {
      const datePart = s.slice(0, 8)
      const gameCode = s.slice(8, 13)
      const periodIdx = parseInt(s.slice(13), 10)
      if (periodIdx >= 1440) {
        try {
          const year = parseInt(datePart.slice(0, 4), 10)
          const month = parseInt(datePart.slice(4, 6), 10) - 1
          const day = parseInt(datePart.slice(6, 8), 10)
          const d = new Date(Date.UTC(year, month, day))
          d.setUTCDate(d.getUTCDate() + 1)
          const nextYear = d.getUTCFullYear()
          const nextMonth = String(d.getUTCMonth() + 1).padStart(2, '0')
          const nextDay = String(d.getUTCDate()).padStart(2, '0')
          return `${nextYear}${nextMonth}${nextDay}${gameCode}0001`
        } catch { /* noop */ }
      }
      const nextIdx = periodIdx + 1
      return `${datePart}${gameCode}${String(nextIdx).padStart(4, '0')}`
    }
    try {
      return String(BigInt(issueNumber) + 1n)
    } catch {
      const num = parseInt(issueNumber.slice(-5), 10) + 1
      return issueNumber.slice(0, -5) + String(num).padStart(5, '0')
    }
  },

  formatLast4(issueNumber: string | null): string {
    if (!issueNumber) return '----'
    const str = String(issueNumber)
    return '#' + (str.length >= 4 ? str.slice(-4) : str)
  },

  getSecondsLeft(date: Date = new Date()): number {
    return 60 - (date.getSeconds() % 60)
  }
}
