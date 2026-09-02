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
  const userTaken = history.filter(h => h.predicted_type !== null && h.predicted_type !== undefined)
  
  const allCount = userTaken.length
  const winCount = userTaken.filter(
    h => h.predicted_type && h.actual_result && h.predicted_type.toUpperCase() === h.actual_result.toUpperCase()
  ).length
  const lossCount = userTaken.filter(
    h => h.predicted_type && h.actual_result && h.predicted_type.toUpperCase() !== h.actual_result.toUpperCase()
  ).length

  let items = userTaken.slice(0, 30)

  if (activeFilter === 'WINS') {
    items = items.filter(
      h =>
        h.predicted_type &&
        h.actual_result &&
        h.predicted_type.toUpperCase() === h.actual_result.toUpperCase()
    )
  } else if (activeFilter === 'LOSSES') {
    items = items.filter(
      h =>
        h.predicted_type &&
        h.actual_result &&
        h.predicted_type.toUpperCase() !== h.actual_result.toUpperCase()
    )
  }

  const emptyMsg =
    activeFilter === 'ALL'
      ? 'No taken predictions yet. Your unlocked signals will appear here.'
      : `No ${activeFilter.toLowerCase()} recorded in your taken history.`

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
            All ({allCount})
          </button>
          <button
            onClick={() => onFilterChange('WINS')}
            className={cn('filter-pill', activeFilter === 'WINS' && 'active')}
          >
            Wins ({winCount})
          </button>
          <button
            onClick={() => onFilterChange('LOSSES')}
            className={cn('filter-pill', activeFilter === 'LOSSES' && 'active')}
          >
            Losses ({lossCount})
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
                const actualType = (item.actual_result || '').toUpperCase()
                const actualNum =
                  item.actual_number !== null && item.actual_number !== undefined
                    ? item.actual_number
                    : '-'
                const isWin = item.predicted_type && item.actual_result && item.predicted_type.toUpperCase() === item.actual_result.toUpperCase()

                return (
                  <tr key={item.issue_number || idx} className={cn(isWin && 'row-win')}>
                    <td className="col-period">
                      #{period4}
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
                        actual={item.actual_result}
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

