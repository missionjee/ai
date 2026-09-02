/**
 * Period calculation helpers — TypeScript port
 */

export const PeriodHelper = {
  /**
   * Generates the deterministic active period for the given timestamp (UTC-based).
   * Tiranga 1M lottery periods run 0001 to 1440 every UTC day.
   */
  getCurrentPeriod(date: Date = new Date()): string {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes() + 1
    const periodIdx = Math.min(1440, Math.max(1, minuteOfDay))
    return `${y}${m}${d}10001${String(periodIdx).padStart(4, '0')}`
  },

  /**
   * Generates the period that just concluded and is awaiting draw settlement.
   */
  getPreviousPeriod(date: Date = new Date()): string {
    const prevDate = new Date(date.getTime() - 60000)
    return this.getCurrentPeriod(prevDate)
  },

  generateFallbackPeriod(date: Date = new Date()): string {
    return this.getCurrentPeriod(date)
  },

  getNextPeriod(issueNumber: string): string {
    if (!issueNumber) return this.getCurrentPeriod()
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
    const str = String(issueNumber).trim()
    const clean = str.startsWith('#') ? str.slice(1) : str
    return '#' + (clean.length >= 4 ? clean.slice(-4) : clean)
  },

  getSecondsLeft(date: Date = new Date()): number {
    return 60 - (date.getSeconds() % 60)
  }
}
