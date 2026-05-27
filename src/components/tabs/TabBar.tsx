import { useState, useRef, useEffect } from 'react'
import { Plus, MoreVertical, GripHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { Tab } from '@/types'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onAddTab: () => void
  onRenameTab: (id: string, title: string) => Promise<void>
  onDeleteTab: (id: string) => Promise<void>
  onReorderTabs: (ids: string[]) => Promise<void>
}

interface SortableTabProps {
  tab: Tab
  isActive: boolean
  onSelect: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}

function SortableTab({ tab, isActive, onSelect, onRename, onDelete }: SortableTabProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(tab.title)
  const menuRef = useRef<HTMLDivElement>(null)
  const isDescription = tab.type === 'description'
  const { t } = useTranslation()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: isDescription })

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (editTitle.trim() && editTitle !== tab.title) await onRename(editTitle.trim())
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex shrink-0 items-center gap-1 border-b-2 px-3 py-2.5 text-sm transition-colors cursor-pointer select-none',
        isDragging ? 'z-10 opacity-75' : '',
        isActive
          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-medium'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
      )}
      onClick={onSelect}
    >
      {!isDescription && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripHorizontal size={12} />
        </span>
      )}

      {editing ? (
        <form onSubmit={handleRename} onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => { if (editTitle === tab.title) setEditing(false) }}
            className="w-24 rounded border border-indigo-300 bg-white dark:bg-slate-700 px-1 py-0 text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
          />
        </form>
      ) : (
        <span>{tab.title}</span>
      )}

      {!isDescription && (
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded p-0.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-500 dark:hover:text-slate-300 transition-opacity"
            aria-label="Options"
          >
            <MoreVertical size={12} />
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-6 z-20 w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { setEditing(true); setMenuOpen(false) }}
              >
                {t('tabBar.rename')}
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { onDelete(); setMenuOpen(false) }}
              >
                {t('tabBar.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  onReorderTabs,
}: TabBarProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { t } = useTranslation()

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tabs.findIndex((tab) => tab.id === active.id)
    const newIndex = tabs.findIndex((tab) => tab.id === over.id)
    const newOrder = arrayMove(tabs, oldIndex, newIndex)
    onReorderTabs(newOrder.map((tab) => tab.id))
  }

  return (
    <div className="flex items-end border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-none bg-white dark:bg-slate-900">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => onSelectTab(tab.id)}
              onRename={(title) => onRenameTab(tab.id, title)}
              onDelete={() => onDeleteTab(tab.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={onAddTab}
        className="flex shrink-0 items-center gap-1 border-b-2 border-transparent px-3 py-2.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        aria-label={t('tabBar.addTab')}
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
