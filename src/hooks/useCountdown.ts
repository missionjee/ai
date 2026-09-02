/**
 * useCountdown — Precise 60s countdown timer hook
 */

import { useState, useEffect } from 'react'
import { PeriodHelper } from '@/engine/periodHelper'

export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(PeriodHelper.getSecondsLeft())

  useEffect(() => {
    const checkSeconds = () => {
      const next = PeriodHelper.getSecondsLeft()
      setSecondsLeft(prev => (prev !== next ? next : prev))
    }
    const interval = setInterval(checkSeconds, 250)
    return () => clearInterval(interval)
  }, [])

  const formatted = `00:${String(secondsLeft).padStart(2, '0')}`
  const isUrgent = secondsLeft <= 10

  return { secondsLeft, formatted, isUrgent }
}
