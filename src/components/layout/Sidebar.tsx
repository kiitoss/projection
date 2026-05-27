import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Tag } from '@/types'

interface SidebarProps {
  tags: Tag[]
  projectCountByTag: Record<string, number>
  totalCount: number
  onCreateTag?: () => void
}

export function Sidebar({ tags, projectCountByTag, totalCount, onCreateTag }: SidebarProps) {
  const { selectedTagIds, toggleTagFilter, clearTagFilters, sidebarOpen, setSidebarOpen } = useAppStore()
  const { t } = useTranslation()

  const content = (
    <nav className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between px-2 lg:hidden">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('sidebar.filters')}</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label={t('sidebar.close')}
        >
          <X size={16} />
        </button>
      </div>

      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {t('sidebar.tags')}
      </p>

      <button
        onClick={clearTagFilters}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors',
          selectedTagIds.length === 0
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
        )}
      >
        <span>{t('sidebar.all')}</span>
        <span className="text-xs text-slate-400">{totalCount}</span>
      </button>

      <div className="mt-1 flex flex-col gap-0.5">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => toggleTagFilter(tag.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors',
              selectedTagIds.includes(tag.id)
                ? 'font-medium'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
            style={
              selectedTagIds.includes(tag.id)
                ? { backgroundColor: `${tag.color}20`, color: tag.color }
                : {}
            }
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </span>
            <span className="text-xs text-slate-400">{projectCountByTag[tag.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onCreateTag}
        className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <Plus size={14} />
        {t('sidebar.createTag')}
      </button>
    </nav>
  )

  return (
    <>
      <aside className="hidden lg:block w-52 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-full overflow-y-auto">
        {content}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-56 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
