/**
 * Toast notification component
 */

import { cn } from '@/lib/utils'

interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
      'px-4 py-2.5 rounded-[10px] text-[13px] font-bold text-white',
      'animate-toast-in',
      'max-w-[90vw] text-center'
    )}
      style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #334155',
        borderTop: '1px solid #475569',
        borderBottom: '2px solid #000',
        boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
      }}
    >
      {message}
    </div>
  )
}
