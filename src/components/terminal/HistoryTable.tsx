/**
 * HistoryTable — Draw history with 3D tactile bevels, strict column proportions,
 * and authentic institutional styling matching demo.html.
 */

import { cn } from '@/lib/utils'
import { PeriodHelper } from '@/engine/periodHelper'
import type { FilterType, HistoryEntry } from '@/types'

interface HistoryTableProps {
  history: HistoryEntry[]
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

function OutcomeBadge({ predicted, actual }: { predicted: string | null; actual: string | null }) {
  if (!predicted || !actual) {
    return <span className="outcome-pill PENDING">PENDING</span>
  }
  const isWin = predicted.toUpperCase() === actual.toUpperCase()
  return (
    <span className={cn('outcome-pill', isWin ? 'WIN' : 'LOSS')}>
      {isWin ? 'WIN' : 'LOSS'}
    </span>
  )
}

function SignalBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-[#64748b] text-[11px] font-mono">--</span>
  const isBig = type.toUpperCase() === 'BIG'
  return (
    <span
      className={cn(
        'table-signal-badge',
        isBig ? 'BIG' : 'SMALL'
      )}
    >
      {type.toUpperCase()}
    </span>
  )
}

export function HistoryTable({ history, activeFilter, onFilterChange }: HistoryTableProps) {
  // Helper: Canonicalize actual type strictly from actual_number (0-4: SMALL, 5-9: BIG)
  const getCanonicalType = (item: HistoryEntry): 'BIG' | 'SMALL' | '' => {
    if (item.actual_number !== null && item.actual_number !== undefined && !isNaN(Number(item.actual_number))) {
      return Number(item.actual_number) >= 5 ? 'BIG' : 'SMALL'
    }
    if (item.actual_result) {
      const u = String(item.actual_result).trim().toUpperCase()
      if (u === 'BIG' || u === 'SMALL') return u
    }
    return ''
  }

  // Strictly completed draws only (must have settled number or result)
  const resolvedList = history.filter(h => {
    const hasNum = h.actual_number !== null && h.actual_number !== undefined
    const hasRes = h.actual_result !== null && h.actual_result !== undefined && String(h.actual_result).toLowerCase() !== 'waiting'
    return hasNum || hasRes
  })
  
  let items = resolvedList.slice(0, 30)

  if (activeFilter === 'WINS') {
    items = resolvedList.filter(
      h => {
        const p = String(h.predicted_type || '').toUpperCase()
        const a = getCanonicalType(h)
        return p && a && p === a
      }
    ).slice(0, 30)
  } else if (activeFilter === 'LOSSES') {
    items = resolvedList.filter(
      h => {
        const p = String(h.predicted_type || '').toUpperCase()
        const a = getCanonicalType(h)
        return !p || !a || p !== a
      }
    ).slice(0, 30)
  }

  const winCount = resolvedList.filter(h => {
    const p = String(h.predicted_type || '').toUpperCase()
    const a = getCanonicalType(h)
    return p && a && p === a
  }).length
  const lossCount = resolvedList.filter(h => {
    const p = String(h.predicted_type || '').toUpperCase()
    const a = getCanonicalType(h)
    return !p || !a || p !== a
  }).length
  const counts = {
    all: resolvedList.length,
    wins: winCount,
    losses: lossCount
  }

  const emptyMsg =
    activeFilter === 'ALL'
      ? 'No draw history recorded yet.'
      : `No ${activeFilter.toLowerCase()} recorded in draw history.`

  return (
    <section className="history-card">
      {/* Header & Filter Pills */}
      <div className="history-header">
        <h2 className="history-title">Draw History</h2>
        <div className="filter-segmented-bar">
          <button
            onClick={() => onFilterChange('ALL')}
            className={cn('filter-pill', activeFilter === 'ALL' && 'active')}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => onFilterChange('WINS')}
            className={cn('filter-pill', activeFilter === 'WINS' && 'active')}
          >
            Wins ({counts.wins})
          </button>
          <button
            onClick={() => onFilterChange('LOSSES')}
            className={cn('filter-pill', activeFilter === 'LOSSES' && 'active')}
          >
            Losses ({counts.losses})
          </button>
        </div>
      </div>

      {/* No-Scroll Responsive History Table */}
      <div className="history-table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th className="col-period">Period</th>
              <th className="col-signal">Signal</th>
              <th className="col-result">Result</th>
              <th className="col-outcome">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[12px] text-[#64748b]">
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const period4 = PeriodHelper.formatLast4(item.issue_number)
                const actualType = getCanonicalType(item)
                const actualNum =
                  item.actual_number !== null && item.actual_number !== undefined
                    ? item.actual_number
                    : '-'
                const predType = item.predicted_type ? String(item.predicted_type).toUpperCase() : null
                const isWin = predType && actualType && predType === actualType

                return (
                  <tr key={item.issue_number || idx} className={cn(isWin && 'row-win')}>
                    <td className="col-period">
                      {period4}
                    </td>
                    <td className="col-signal">
                      <SignalBadge type={item.predicted_type} />
                    </td>
                    <td className="col-result">
                      {actualType ? (
                        <div className="result-group">
                          <span
                            className={cn(
                              actualType === 'BIG' ? 'text-[#fb7185]' : 'text-[#38bdf8]'
                            )}
                          >
                            {actualType}
                          </span>
                          <span className="result-num-chip">
                            {actualNum}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#64748b] text-[11px] font-mono">Waiting...</span>
                      )}
                    </td>
                    <td className="col-outcome">
                      <OutcomeBadge
                        predicted={item.predicted_type}
                        actual={actualType}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

