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
      'px-4 py-2 rounded-[12px] text-[12.5px] font-black text-white',
      'animate-toast-in',
      'max-w-[92vw] text-center whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-center gap-1.5'
    )}
      style={{
        background: 'rgba(10, 14, 22, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderTop: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      {message}
    </div>
  )
}
