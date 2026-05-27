import { useCallback, useEffect, useState } from 'react'
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
import { GripVertical, Pencil, RefreshCw, Trash2, Plus, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { generateWithGemini, buildProjectContext } from '@/lib/gemini'
import { formatRelativeDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/useAppStore'
import type { ProjectWithRelations, Tab, Widget } from '@/types'

interface WidgetsTabProps {
  tab: Tab
  project: ProjectWithRelations
}

export function WidgetsTab({ tab, project }: WidgetsTabProps) {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [confirmRegenAll, setConfirmRegenAll] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { t } = useTranslation()

  const fetchWidgets = useCallback(async () => {
    const { data } = await supabase
      .from('widgets')
      .select('*')
      .eq('tab_id', tab.id)
      .order('position')
    setWidgets((data as Widget[]) ?? [])
  }, [tab.id])

  useEffect(() => { fetchWidgets() }, [fetchWidgets])

  async function getContext() {
    const { data: chaosTabs } = await supabase
      .from('tabs')
      .select('id, title')
      .eq('project_id', project.id)
      .eq('type', 'chaos')

    const chaosContents: { title: string; content: string }[] = []
    if (chaosTabs?.length) {
      const { data: chaosRows } = await supabase
        .from('chaos_content')
        .select('content, tab_id')
        .in('tab_id', (chaosTabs as { id: string; title: string }[]).map((ct) => ct.id))

      for (const row of (chaosRows as { content: string; tab_id: string }[]) ?? []) {
        const tabName = (chaosTabs as { id: string; title: string }[]).find((ct) => ct.id === row.tab_id)?.title ?? 'Chaos'
        chaosContents.push({ title: tabName, content: row.content })
      }
    }

    const { data: todos } = await supabase
      .from('todos')
      .select('content, completed, urgent')
      .in(
        'tab_id',
        (
          await supabase.from('tabs').select('id').eq('project_id', project.id).eq('type', 'todo')
        ).data?.map((tab: { id: string }) => tab.id) ?? [],
      )

    return buildProjectContext({
      projectName: project.name,
      longDescription: project.long_description,
      keyPoints: project.key_points,
      chaosContents,
      todos: (todos as { content: string; completed: boolean; urgent: boolean }[]) ?? [],
    })
  }

  async function getApiKey() {
    const { data } = await supabase.from('user_settings').select('gemini_api_key').single()
    return data?.gemini_api_key ?? null
  }

  async function generateWidget(widget: Widget) {
    const apiKey = await getApiKey()
    if (!apiKey) {
      toast.error(t('widgetsTab.noKeyError'), true)
      return
    }
    const context = await getContext()
    const content = await generateWithGemini(apiKey, widget.prompt, context)
    const { error } = await supabase
      .from('widgets')
      .update({ content, last_generated_at: new Date().toISOString() })
      .eq('id', widget.id)
    if (!error) {
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === widget.id ? { ...w, content, last_generated_at: new Date().toISOString() } : w,
        ),
      )
    }
  }

  async function handleRegenAll() {
    const apiKey = await getApiKey()
    if (!apiKey) {
      toast.error(t('widgetsTab.noKeyError'), true)
      return
    }
    const context = await getContext()
    for (const widget of widgets) {
      try {
        const content = await generateWithGemini(apiKey, widget.prompt, context)
        await supabase
          .from('widgets')
          .update({ content, last_generated_at: new Date().toISOString() })
          .eq('id', widget.id)
      } catch {
        toast.error(t('widgetsTab.widgetError', { title: widget.title }))
      }
    }
    await fetchWidgets()
    toast.success(t('widgetsTab.regenerateAllSuccess'))
    setConfirmRegenAll(false)
  }

  async function addWidget(title: string, prompt: string) {
    const position = widgets.length
    const { error } = await supabase
      .from('widgets')
      .insert({ tab_id: tab.id, title, prompt, position })
    if (!error) await fetchWidgets()
  }

  async function updateWidget(id: string, updates: Partial<Widget>) {
    await supabase.from('widgets').update(updates).eq('id', id)
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)))
  }

  async function deleteWidget(id: string) {
    await supabase.from('widgets').delete().eq('id', id)
    setWidgets((prev) => prev.filter((w) => w.id !== id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = widgets.findIndex((w) => w.id === active.id)
    const newIndex = widgets.findIndex((w) => w.id === over.id)
    const newOrder = arrayMove(widgets, oldIndex, newIndex)
    setWidgets(newOrder)
    newOrder.forEach((w, i) => supabase.from('widgets').update({ position: i }).eq('id', w.id))
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('widgetsTab.header', { count: widgets.length })}
        </h3>
        <div className="flex gap-2">
          {widgets.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => widgets.length > 1 ? setConfirmRegenAll(true) : handleRegenAll()}
            >
              <RefreshCw size={13} />
              {t('widgetsTab.regenerateAll')}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} />
            {t('widgetsTab.add')}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                onRegenerate={() => generateWidget(widget)}
                onUpdate={(updates) => updateWidget(widget.id, updates)}
                onDelete={() => deleteWidget(widget.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {widgets.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">
            {t('widgetsTab.emptyState')}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} />
            {t('widgetsTab.addWidgetButton')}
          </Button>
        </div>
      )}

      <AddWidgetModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addWidget}
      />

      <ConfirmDialog
        open={confirmRegenAll}
        onClose={() => setConfirmRegenAll(false)}
        onConfirm={handleRegenAll}
        title={t('widgetsTab.regenerateAllTitle', { count: widgets.length })}
        description={t('widgetsTab.regenerateAllDescription')}
        confirmLabel={t('widgetsTab.regenerate')}
      />
    </div>
  )
}

interface SortableWidgetProps {
  widget: Widget
  onRegenerate: () => Promise<void>
  onUpdate: (updates: Partial<Widget>) => Promise<void>
  onDelete: () => Promise<void>
}

function SortableWidget({ widget, onRegenerate, onUpdate, onDelete }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  })
  const [editOpen, setEditOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { t } = useTranslation()

  async function handleRegen() {
    setGenerating(true)
    await onRegenerate()
    setGenerating(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100"
            aria-label={t('widgetsTab.move')}
          >
            <GripVertical size={14} />
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {widget.title}
          </span>
          {widget.last_generated_at && (
            <span className="text-xs text-slate-400">
              · {formatRelativeDate(widget.last_generated_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditOpen(true)}
            className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title={t('widgetsTab.editPrompt')}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleRegen}
            disabled={generating}
            className="rounded p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-50"
            title={t('widgetsTab.regenerate')}
          >
            {generating ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            ) : (
              <RefreshCw size={13} />
            )}
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:text-red-500"
            title={t('common.delete')}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {widget.content ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {widget.content}
          </p>
        ) : (
          <button
            onClick={handleRegen}
            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600"
          >
            <Zap size={12} />
            {t('widgetsTab.generateButton')}
          </button>
        )}
      </div>

      <EditWidgetModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        widget={widget}
        onSave={(title, prompt) => onUpdate({ title, prompt })}
      />
    </div>
  )
}

function AddWidgetModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (title: string, prompt: string) => Promise<void>
}) {
  const [custom, setCustom] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const presetWidgets = [
    { title: t('widgetsTab.presets.topTodos'), prompt: t('widgetsTab.presets.topTodosPrompt') },
    { title: t('widgetsTab.presets.importantDates'), prompt: t('widgetsTab.presets.importantDatesPrompt') },
    { title: t('widgetsTab.presets.progressSummary'), prompt: t('widgetsTab.presets.progressSummaryPrompt') },
    { title: t('widgetsTab.presets.blockers'), prompt: t('widgetsTab.presets.blockersPrompt') },
  ]

  async function handlePreset(preset: { title: string; prompt: string }) {
    setLoading(true)
    await onAdd(preset.title, preset.prompt)
    setLoading(false)
    onClose()
  }

  async function handleCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !prompt.trim()) return
    setLoading(true)
    await onAdd(title.trim(), prompt.trim())
    setLoading(false)
    setTitle('')
    setPrompt('')
    setCustom(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('widgetsTab.addWidget')} size="md">
      <div className="flex flex-col gap-4">
        {!custom ? (
          <>
            <div className="flex flex-col gap-2">
              {presetWidgets.map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => handlePreset(preset)}
                  disabled={loading}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{preset.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{preset.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setCustom(true)}
              className="text-sm text-indigo-500 hover:text-indigo-600 text-left"
            >
              {t('widgetsTab.customWidget')}
            </button>
          </>
        ) : (
          <form onSubmit={handleCustom} className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('widgetsTab.widgetTitleLabel')}</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('widgetsTab.widgetNamePlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('widgetsTab.promptLabel')}</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('widgetsTab.promptPlaceholder')}
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCustom(false)}>{t('common.back')}</Button>
              <Button type="submit" variant="primary" size="sm" loading={loading} disabled={!title.trim() || !prompt.trim()}>
                {t('common.add')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

function EditWidgetModal({
  open,
  onClose,
  widget,
  onSave,
}: {
  open: boolean
  onClose: () => void
  widget: Widget
  onSave: (title: string, prompt: string) => Promise<void>
}) {
  const [title, setTitle] = useState(widget.title)
  const [prompt, setPrompt] = useState(widget.prompt)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSave(title.trim(), prompt.trim())
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('widgetsTab.editWidget')} size="md">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('widgetsTab.widgetTitleLabel')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('widgetsTab.promptLabel')}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={loading}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
