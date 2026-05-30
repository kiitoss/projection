import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <label className={cn('flex items-center gap-2 cursor-pointer select-none', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          checked ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 m-0.5',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      {label && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      )}
    </label>
  )
}
