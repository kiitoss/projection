import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { ToastMessage } from '@/types'

const icons = {
  success: <CheckCircle size={16} className="text-green-500" />,
  error: <XCircle size={16} className="text-red-500" />,
  info: <Info size={16} className="text-indigo-500" />,
}

const borders: Record<ToastMessage['type'], string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-indigo-500',
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const removeToast = useAppStore((s) => s.removeToast)

  useEffect(() => {
    if (toast.persistent) return
    const timer = setTimeout(() => removeToast(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.persistent, removeToast])

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-l-4 bg-white dark:bg-slate-800',
        'border-slate-200 dark:border-slate-700 px-4 py-3 shadow-md',
        borders[toast.type],
      )}
    >
      <span className="mt-0.5 shrink-0">{icons[toast.type]}</span>
      <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
