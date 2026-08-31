/**
 * HistoryTable — Draw history with 3D tactile bevels, strict column proportions,
 * and authentic institutional styling.
 */

import { cn } from '@/lib/utils'
import { PeriodHelper } from '@/engine/periodHelper'
import type { FilterType, HistoryEntry } from '@/types'

interface HistoryTableProps {
  history: HistoryEntry[]
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'WINS', label: 'Wins' },
  { key: 'LOSSES', label: 'Losses' },
]

function OutcomeBadge({ predicted, actual }: { predicted: string | null; actual: string | null }) {
  if (!predicted || !actual) {
    return <span className="hist-outcome PENDING">PENDING</span>
  }
  const isWin = predicted.toUpperCase() === actual.toUpperCase()
  return (
    <span className={cn('hist-outcome', isWin ? 'WIN' : 'LOSS')}>
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
        'font-mono font-extrabold text-[13px]',
        isBig ? 'text-[#fb7185]' : 'text-[#38bdf8]'
      )}
    >
      {type.toUpperCase()}
    </span>
  )
}

export function HistoryTable({ history, activeFilter, onFilterChange }: HistoryTableProps) {
  const userTaken = history.filter(h => h.predicted_type !== null && h.predicted_type !== undefined)
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
    <section className="bevel-card p-4 sm:p-5 flex flex-col gap-3.5">
      {/* Header & Filter Pills */}
      <div className="flex justify-between items-center pb-3 border-b border-[#1e2532] flex-wrap gap-2">
        <h2 className="font-display font-black text-[15px] text-white tracking-[0.5px]">
          Draw History
        </h2>
        <div className="flex items-center gap-1.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={cn('filter-pill', activeFilter === key && 'active')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* History Table with strict column proportions */}
      <div className="overflow-x-auto rounded-[12px] border border-[#1e2532] bg-[#05070a]">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-[#0d1117] border-b border-[#1e293b]">
              <th className="w-[35%] px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">
                Period
              </th>
              <th className="w-[22%] px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">
                Signal
              </th>
              <th className="w-[23%] px-3 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">
                Result
              </th>
              <th className="w-[20%] px-3 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-[0.8px] text-[#64748b]">
                Outcome
              </th>
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

                return (
                  <tr
                    key={item.issue_number || idx}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-3 font-mono text-[#cbd5e1] font-semibold">
                      {period4}
                    </td>
                    <td className="px-3 py-3">
                      <SignalBadge type={item.predicted_type} />
                    </td>
                    <td className="px-3 py-3">
                      {actualType ? (
                        <div className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold">
                          <span
                            className={cn(
                              actualType === 'BIG' ? 'text-[#fb7185]' : 'text-[#38bdf8]'
                            )}
                          >
                            {actualType}
                          </span>
                          <span className="bg-white/[0.08] px-1.5 py-0.5 rounded text-white text-[12px]">
                            {actualNum}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#64748b] text-[11px]">Waiting...</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
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
