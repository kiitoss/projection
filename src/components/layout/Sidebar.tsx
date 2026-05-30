import { Settings2, X, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Tag } from '@/types'

interface SidebarProps {
  tags: Tag[]
  projectCountByTag: Record<string, number>
  totalCount: number
  onManageTags?: () => void
  onReorderTags?: (tags: Tag[]) => void
}

export function Sidebar({ tags, projectCountByTag, totalCount, onManageTags, onReorderTags }: SidebarProps) {
  const { selectedTagIds, toggleTagFilter, clearTagFilters, sidebarOpen, setSidebarOpen } = useAppStore()
  const { t } = useTranslation()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorderTags) return
    const oldIndex = tags.findIndex((t) => t.id === active.id)
    const newIndex = tags.findIndex((t) => t.id === over.id)
    onReorderTags(arrayMove(tags, oldIndex, newIndex))
  }

  const content = (
    <nav className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between px-2 lg:hidden">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('sidebar.filters')}</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          aria-label={t('sidebar.close')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t('sidebar.tags')}
        </p>
        {onManageTags && (
          <button
            onClick={onManageTags}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={t('sidebar.manageTags')}
          >
            <Settings2 size={13} />
          </button>
        )}
      </div>

      <button
        onClick={clearTagFilters}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer',
          selectedTagIds.length === 0
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
        )}
      >
        <span>{t('sidebar.all')}</span>
        <span className="text-xs text-slate-400">{totalCount}</span>
      </button>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={tags.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-1 flex flex-col gap-0.5">
            {tags.map((tag) => (
              <SortableTag
                key={tag.id}
                tag={tag}
                selected={selectedTagIds.includes(tag.id)}
                count={projectCountByTag[tag.id] ?? 0}
                onClick={() => toggleTagFilter(tag.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {onManageTags && (
        <button
          onClick={onManageTags}
          className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Plus size={12} />
          {t('sidebar.createTag')}
        </button>
      )}
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

function SortableTag({
  tag,
  selected,
  count,
  onClick,
}: {
  tag: Tag
  selected: boolean
  count: number
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag.id })

  return (
    <button
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(selected ? { backgroundColor: `${tag.color}20`, color: tag.color } : {}),
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer',
        selected
          ? 'font-medium'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
        isDragging && 'opacity-50',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
        {tag.name}
      </span>
      <span className="text-xs text-slate-400">{count}</span>
    </button>
  )
}
