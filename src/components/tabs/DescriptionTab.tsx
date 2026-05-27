import { useRef, useState, useCallback } from 'react'
import { Plus, Trash2, Globe, GripVertical } from 'lucide-react'
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { ProjectWithRelations } from '@/types'

interface DescriptionTabProps {
  project: ProjectWithRelations
  onUpdate: (updates: Partial<ProjectWithRelations>) => Promise<void>
  onAddLink: (url: string, label?: string) => Promise<void>
  onDeleteLink: (id: string) => Promise<void>
}

export function DescriptionTab({ project, onUpdate, onAddLink, onDeleteLink }: DescriptionTabProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saved, setSaved] = useState(true)

  const debounce = useCallback((fn: () => void) => {
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fn()
      setSaved(true)
    }, 1000)
  }, [])

  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl">
      <SaveIndicator saved={saved} />

      <ShortDescSection project={project} onUpdate={onUpdate} debounce={debounce} />
      <LongDescSection project={project} onUpdate={onUpdate} debounce={debounce} />
      <KeyPointsSection project={project} onUpdate={onUpdate} />
      <LinksSection project={project} onAddLink={onAddLink} onDeleteLink={onDeleteLink} />
    </div>
  )
}

function SaveIndicator({ saved }: { saved: boolean }) {
  const { t } = useTranslation()
  if (saved) return null
  return (
    <div className="fixed bottom-16 right-4 z-10 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
      {t('common.saving')}
    </div>
  )
}

function ShortDescSection({
  project,
  onUpdate,
  debounce,
}: {
  project: ProjectWithRelations
  onUpdate: (u: Partial<ProjectWithRelations>) => Promise<void>
  debounce: (fn: () => void) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('descriptionTab.shortDesc')}
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={project.show_short_desc_on_card}
            onChange={(e) => onUpdate({ show_short_desc_on_card: e.target.checked })}
            className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
          />
          {t('descriptionTab.showOnCard')}
        </label>
      </div>
      <input
        defaultValue={project.short_description ?? ''}
        onChange={(e) => debounce(() => onUpdate({ short_description: e.target.value || null }))}
        placeholder={t('descriptionTab.shortDescPlaceholder')}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}

function LongDescSection({
  project,
  onUpdate,
  debounce,
}: {
  project: ProjectWithRelations
  onUpdate: (u: Partial<ProjectWithRelations>) => Promise<void>
  debounce: (fn: () => void) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t('descriptionTab.longDesc')}
      </label>
      <textarea
        defaultValue={project.long_description ?? ''}
        onChange={(e) => debounce(() => onUpdate({ long_description: e.target.value || null }))}
        placeholder={t('descriptionTab.longDescPlaceholder')}
        rows={8}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
      />
    </div>
  )
}

function SortablePoint({ id, value, onChange, onDelete }: {
  id: string; value: string; onChange: (v: string) => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const { t } = useTranslation()
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2', isDragging && 'opacity-50')}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-300 dark:text-slate-600 hover:text-slate-500"
        aria-label={t('descriptionTab.reorder')}
      >
        <GripVertical size={14} />
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('descriptionTab.keyPointPlaceholder')}
        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        onClick={onDelete}
        className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
        aria-label={t('common.delete')}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function KeyPointsSection({
  project,
  onUpdate,
}: {
  project: ProjectWithRelations
  onUpdate: (u: Partial<ProjectWithRelations>) => Promise<void>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { t } = useTranslation()

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = project.key_points.indexOf(active.id as string)
    const newIndex = project.key_points.indexOf(over.id as string)
    const newPoints = arrayMove(project.key_points, oldIndex, newIndex)
    onUpdate({ key_points: newPoints })
  }

  function updatePoint(index: number, value: string) {
    const newPoints = [...project.key_points]
    newPoints[index] = value
    onUpdate({ key_points: newPoints })
  }

  function deletePoint(index: number) {
    const newPoints = project.key_points.filter((_, i) => i !== index)
    onUpdate({ key_points: newPoints })
  }

  function addPoint() {
    onUpdate({ key_points: [...project.key_points, ''] })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('descriptionTab.keyPoints')}
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
            {t('descriptionTab.showCount')}
            <input
              type="number"
              min={1}
              max={10}
              value={project.max_key_points_on_card}
              onChange={(e) => onUpdate({ max_key_points_on_card: parseInt(e.target.value) || 3 })}
              className="w-12 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {t('descriptionTab.onCard')}
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={project.show_key_points_on_card}
              onChange={(e) => onUpdate({ show_key_points_on_card: e.target.checked })}
              className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
            />
            {t('descriptionTab.showOnCard')}
          </label>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={project.key_points} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {project.key_points.map((point, i) => (
              <SortablePoint
                key={`${i}-${point}`}
                id={point}
                value={point}
                onChange={(v) => updatePoint(i, v)}
                onDelete={() => deletePoint(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={addPoint}
        className="mt-2 flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
      >
        <Plus size={14} />
        {t('descriptionTab.addPoint')}
      </button>
    </div>
  )
}

function LinksSection({
  project,
  onAddLink,
  onDeleteLink,
}: {
  project: ProjectWithRelations
  onAddLink: (url: string, label?: string) => Promise<void>
  onDeleteLink: (id: string) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const { t } = useTranslation()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    await onAddLink(url.trim(), label.trim() || undefined)
    setUrl('')
    setLabel('')
    setAdding(false)
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t('descriptionTab.links')}
      </label>

      <div className="flex flex-col gap-2 mb-3">
        {project.project_links.map((link) => (
          <div key={link.id} className="flex items-center gap-2 text-sm">
            <Globe size={14} className="text-indigo-400 shrink-0" />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-indigo-500 hover:underline truncate"
            >
              {link.label || link.url}
            </a>
            <button
              onClick={() => onDeleteLink(link.id)}
              className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
              aria-label={t('common.delete')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('descriptionTab.urlPlaceholder')}
            type="url"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('descriptionTab.labelPlaceholder')}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button type="submit" className="text-sm text-indigo-500 hover:text-indigo-600">{t('common.add')}</button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-slate-400 hover:text-slate-600">{t('common.cancel')}</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
        >
          <Plus size={14} />
          {t('descriptionTab.addLink')}
        </button>
      )}
    </div>
  )
}
