import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpDown, ListTodo, X } from 'lucide-react'
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { ProjectCard } from '@/components/project/ProjectCard'
import { CreateProjectModal } from '@/components/project/CreateProjectModal'
import { TagsModal } from '@/components/ui/TagsModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useProjects } from '@/hooks/useProjects'
import { useTags } from '@/hooks/useTags'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { generateWithGemini, buildProjectContext } from '@/lib/gemini'
import { toast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { Widget, DigestTabConfig, ProjectWithRelations, CardTodo } from '@/types'

interface GlobalRegenItems {
  digestTabs: Array<{ tabId: string; projectId: string; chaosTabIds: string[]; prompt: string }>
  widgets: Array<Widget & { projectId: string }>
}

const ORDER_KEY = 'projection-project-order'

function getStoredOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') }
  catch { return [] }
}

function saveOrder(ids: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
}

interface SortableCardProps {
  project: ProjectWithRelations
  onDelete: (id: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
}

function SortableProjectCard({ project, onDelete, onArchive, onRename }: SortableCardProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-50 z-50')}
    >
      <ProjectCard project={project} onDelete={onDelete} onArchive={onArchive} onRename={onRename} />
    </div>
  )
}

export function HomePage() {
  const { projects, loading, createProject, updateProject, deleteProject, archiveProject } = useProjects()
  const { tags, createTag, updateTag, deleteTag, reorderTags } = useTags()
  const { selectedTagIds, searchQuery, setSearchQuery, sortBy, setSortBy } = useAppStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [tagsModalOpen, setTagsModalOpen] = useState(false)
  const [regenAllOpen, setRegenAllOpen] = useState(false)
  const [regenAllLoading, setRegenAllLoading] = useState(false)
  const [regenCheckLoading, setRegenCheckLoading] = useState(false)
  const [regenAllItems, setRegenAllItems] = useState<GlobalRegenItems | null>(null)
  const [regenProgress, setRegenProgress] = useState<{ current: number; total: number } | null>(null)
  const [showTodosPanel, setShowTodosPanel] = useState(false)
  const [localOrder, setLocalOrder] = useState<string[]>(() => getStoredOrder())
  const [panelTodos, setPanelTodos] = useState<Array<{ project: ProjectWithRelations; todos: CardTodo[] }>>([])
  const { t } = useTranslation()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    setPanelTodos(
      projects
        .filter((p) => (p.urgent_todos?.length ?? 0) > 0)
        .map((p) => ({ project: p, todos: p.urgent_todos! })),
    )
  }, [projects])

  const filteredProjects = useMemo(() => {
    let list = [...projects]

    if (selectedTagIds.length > 0) {
      list = list.filter((p) =>
        selectedTagIds.every((tid) => p.tags.some((tag) => tag.id === tid)),
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }

    return list
  }, [projects, selectedTagIds, searchQuery, sortBy])

  const orderedProjects = useMemo(() => {
    if (sortBy === 'name' || localOrder.length === 0) return filteredProjects
    return [...filteredProjects].sort((a, b) => {
      const ia = localOrder.indexOf(a.id)
      const ib = localOrder.indexOf(b.id)
      if (ia === -1 && ib === -1) return 0
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [filteredProjects, sortBy, localOrder])

  const projectCountByTag = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      for (const tag of p.tags) {
        counts[tag.id] = (counts[tag.id] ?? 0) + 1
      }
    }
    return counts
  }, [projects])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedProjects.findIndex((p) => p.id === active.id)
    const newIndex = orderedProjects.findIndex((p) => p.id === over.id)
    const newOrdered = arrayMove(orderedProjects, oldIndex, newIndex)
    const newOrderedIds = newOrdered.map((p) => p.id)
    const hiddenIds = projects.map((p) => p.id).filter((id) => !newOrderedIds.includes(id))
    const fullOrder = [...newOrderedIds, ...hiddenIds]
    setLocalOrder(fullOrder)
    saveOrder(fullOrder)
  }

  async function handlePanelTodoCheck(projectId: string, todoId: string) {
    const item = panelTodos.find((i) => i.project.id === projectId)
    const todo = item?.todos.find((t) => t.id === todoId)
    if (!todo) return
    const newCompleted = !todo.completed
    setPanelTodos((prev) =>
      prev.map((i) => {
        if (i.project.id !== projectId) return i
        return { ...i, todos: i.todos.map((t) => t.id === todoId ? { ...t, completed: newCompleted } : t) }
      }),
    )
    await supabase.from('todos').update({ completed: newCompleted }).eq('id', todoId)
  }

  async function handleClickRegenerateAll() {
    if (!projects.length) return
    setRegenCheckLoading(true)

    const projectIds = projects.map((p) => p.id)

    const { data: allTabs } = await supabase
      .from('tabs')
      .select('id, project_id, type, config')
      .in('project_id', projectIds)

    const chaosTabs = (allTabs ?? []).filter((t) => t.type === 'chaos') as {
      id: string; project_id: string; type: string; config: Record<string, unknown>
    }[]
    const digestTabs = (allTabs ?? []).filter((t) => t.type === 'digest') as typeof chaosTabs
    const widgetsTabs = (allTabs ?? []).filter((t) => t.type === 'widgets') as typeof chaosTabs

    const chaosContentsMap: { tab_id: string; updated_at: string }[] = []
    if (chaosTabs.length) {
      const { data } = await supabase
        .from('chaos_content')
        .select('tab_id, updated_at')
        .in('tab_id', chaosTabs.map((t) => t.id))
      chaosContentsMap.push(...((data as { tab_id: string; updated_at: string }[]) ?? []))
    }

    const chaosMaxByProject: Record<string, Date> = {}
    for (const cc of chaosContentsMap) {
      const tab = chaosTabs.find((t) => t.id === cc.tab_id)
      if (!tab) continue
      const date = new Date(cc.updated_at)
      if (!chaosMaxByProject[tab.project_id] || date > chaosMaxByProject[tab.project_id]) {
        chaosMaxByProject[tab.project_id] = date
      }
    }

    const staleDigestTabs: GlobalRegenItems['digestTabs'] = []
    for (const digestTab of digestTabs) {
      const config = digestTab.config as unknown as DigestTabConfig
      const chaosTabIds: string[] = config?.chaos_tab_ids ?? []
      if (!chaosTabIds.length) continue

      const relevantChaos = chaosContentsMap.filter((c) => chaosTabIds.includes(c.tab_id))
      if (!relevantChaos.length) continue

      const maxRelevantChaos = new Date(
        Math.max(...relevantChaos.map((r) => new Date(r.updated_at).getTime())),
      )

      const { data: latestGen } = await supabase
        .from('digest_generated')
        .select('generated_at')
        .eq('tab_id', digestTab.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const isStale = !latestGen || maxRelevantChaos > new Date(latestGen.generated_at)
      if (isStale) {
        staleDigestTabs.push({
          tabId: digestTab.id,
          projectId: digestTab.project_id,
          chaosTabIds,
          prompt: (config?.prompt as string) ?? t('digestTab.defaultPrompt'),
        })
      }
    }

    const staleWidgets: GlobalRegenItems['widgets'] = []
    if (widgetsTabs.length) {
      const { data: allWidgets } = await supabase
        .from('widgets')
        .select('*')
        .in('tab_id', widgetsTabs.map((t) => t.id))

      for (const widget of (allWidgets as Widget[]) ?? []) {
        const widgetTab = widgetsTabs.find((t) => t.id === widget.tab_id)
        if (!widgetTab) continue
        const chaosMax = chaosMaxByProject[widgetTab.project_id]
        const isStale =
          !widget.last_generated_at ||
          (chaosMax && chaosMax > new Date(widget.last_generated_at))
        if (isStale) staleWidgets.push({ ...widget, projectId: widgetTab.project_id })
      }
    }

    setRegenCheckLoading(false)

    if (!staleDigestTabs.length && !staleWidgets.length) {
      toast.info(t('project.nothingToRegen'))
      return
    }

    setRegenAllItems({ digestTabs: staleDigestTabs, widgets: staleWidgets })
    setRegenAllOpen(true)
  }

  async function handleConfirmRegenerateAll() {
    if (!regenAllItems) return

    const { data: apiKey } = await supabase.rpc('get_gemini_key')

    if (!apiKey) {
      toast.error(t('digestTab.noKeyError'), true)
      return
    }

    const total = regenAllItems.digestTabs.length + regenAllItems.widgets.length
    setRegenAllLoading(true)
    setRegenProgress({ current: 0, total })

    let current = 0

    for (const { tabId, chaosTabIds, prompt } of regenAllItems.digestTabs) {
      try {
        const [{ data: chaosRows }, { data: chaosTabs }] = await Promise.all([
          supabase.from('chaos_content').select('content, tab_id').in('tab_id', chaosTabIds),
          supabase.from('tabs').select('id, title').in('id', chaosTabIds),
        ])

        const context = ((chaosRows as { content: string; tab_id: string }[]) ?? [])
          .map((row) => {
            const tabName =
              (chaosTabs as { id: string; title: string }[])?.find((ct) => ct.id === row.tab_id)?.title ?? 'Chaos'
            return `## ${tabName}\n\n${row.content}`
          })
          .join('\n\n---\n\n')

        if (!context.trim()) { current++; setRegenProgress({ current, total }); continue }

        const content = await generateWithGemini(apiKey, prompt, context)
        await supabase
          .from('digest_generated')
          .insert({ tab_id: tabId, content, prompt_used: prompt })
      } catch {
        toast.error(t('project.regenDigestError'))
      }
      current++
      setRegenProgress({ current, total })
    }

    const widgetsByProject = regenAllItems.widgets.reduce<Record<string, Array<Widget & { projectId: string }>>>(
      (acc, w) => { (acc[w.projectId] ??= []).push(w); return acc },
      {},
    )

    for (const [projectId, widgets] of Object.entries(widgetsByProject)) {
      try {
        const project = projects.find((p) => p.id === projectId)
        if (!project) { current += widgets.length; setRegenProgress({ current, total }); continue }

        const { data: projectChaosTabs } = await supabase
          .from('tabs')
          .select('id, title')
          .eq('project_id', projectId)
          .eq('type', 'chaos')

        const chaosContents: { title: string; content: string }[] = []
        if (projectChaosTabs?.length) {
          const { data: chaosRows } = await supabase
            .from('chaos_content')
            .select('content, tab_id')
            .in('tab_id', (projectChaosTabs as { id: string; title: string }[]).map((t) => t.id))

          for (const row of (chaosRows as { content: string; tab_id: string }[]) ?? []) {
            const tabTitle = (projectChaosTabs as { id: string; title: string }[]).find((t) => t.id === row.tab_id)?.title ?? 'Chaos'
            chaosContents.push({ title: tabTitle, content: row.content })
          }
        }

        const context = buildProjectContext({
          projectName: project.name,
          longDescription: project.long_description,
          keyPoints: project.key_points,
          chaosContents,
          todos: [],
        })

        const now = new Date().toISOString()
        for (const widget of widgets) {
          try {
            const content = await generateWithGemini(apiKey, widget.prompt, context)
            await supabase
              .from('widgets')
              .update({ content, last_generated_at: now })
              .eq('id', widget.id)
          } catch {
            toast.error(t('widgetsTab.widgetError', { title: widget.title }))
          }
          current++
          setRegenProgress({ current, total })
        }
      } catch {
        toast.error(t('project.regenWidgetsError'))
      }
    }

    setRegenAllLoading(false)
    setRegenProgress(null)
    setRegenAllOpen(false)
    setRegenAllItems(null)
    toast.success(t('project.regenAllSuccess'))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        onNewProject={() => setCreateOpen(true)}
        onRegenerateAll={handleClickRegenerateAll}
        regenerateLoading={regenCheckLoading}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          tags={tags}
          projectCountByTag={projectCountByTag}
          totalCount={projects.length}
          onManageTags={() => setTagsModalOpen(true)}
          onReorderTags={reorderTags}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.searchPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => setSortBy(sortBy === 'updated_at' ? 'name' : 'updated_at')}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ArrowUpDown size={13} />
                {sortBy === 'name' ? t('home.sortAlpha') : t('home.sortRecent')}
              </button>

              <button
                onClick={() => setShowTodosPanel((v) => !v)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs transition-colors cursor-pointer',
                  showTodosPanel
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
                )}
              >
                <ListTodo size={13} />
                {t('home.toggleTodos')}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" className="text-indigo-500" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {projects.length === 0 ? (
                  <>
                    <p className="text-2xl mb-2">📋</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t('home.emptyCreate')}
                    </p>
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors cursor-pointer"
                    >
                      {t('home.createProject')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('home.noResults')}
                    </p>
                    <button
                      onClick={() => { setSearchQuery(''); useAppStore.getState().clearTagFilters() }}
                      className="mt-3 text-sm text-indigo-500 hover:underline cursor-pointer"
                    >
                      {t('home.resetFilters')}
                    </button>
                  </>
                )}
              </div>
            ) : sortBy === 'updated_at' ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedProjects.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {orderedProjects.map((project) => (
                      <SortableProjectCard
                        key={project.id}
                        project={project}
                        onDelete={deleteProject}
                        onArchive={(id) => archiveProject(id, true)}
                        onRename={(id, name) => updateProject(id, { name })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {orderedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={deleteProject}
                    onArchive={(id) => archiveProject(id, true)}
                    onRename={(id, name) => updateProject(id, { name })}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {showTodosPanel && (
          <aside className="w-1/3 min-w-64 max-w-sm shrink-0 border-l border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {t('home.importantTodos')}
                </h2>
                <button
                  onClick={() => setShowTodosPanel(false)}
                  className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <X size={15} />
                </button>
              </div>
              {panelTodos.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t('home.noImportantTodos')}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {panelTodos.map(({ project, todos }) => (
                    <div key={project.id}>
                      <Link
                        to={`/projects/${project.id}`}
                        className="block mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                      >
                        {project.name}
                      </Link>
                      <div className="flex flex-col gap-1.5">
                        {todos.map((todo) => (
                          <label key={todo.id} className="flex items-start gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => handlePanelTodoCheck(project.id, todo.id)}
                              className="mt-0.5 h-3 w-3 shrink-0 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={cn(
                              'text-xs leading-snug',
                              todo.completed
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-600 dark:text-slate-300',
                            )}>
                              {todo.content}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createProject}
        tags={tags}
        onCreateTag={createTag}
      />

      <TagsModal
        open={tagsModalOpen}
        onClose={() => setTagsModalOpen(false)}
        tags={tags}
        onCreateTag={createTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
      />

      <Modal
        open={regenAllOpen}
        onClose={() => { if (!regenAllLoading) setRegenAllOpen(false) }}
        title={t('project.regenAllTitle')}
        size="sm"
      >
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {t('project.regenAllDescription', {
            digests: regenAllItems?.digestTabs.length ?? 0,
            widgets: regenAllItems?.widgets.length ?? 0,
          })}
        </p>
        {regenProgress && (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400">
            <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            {t('project.regenProgress', { current: regenProgress.current, total: regenProgress.total })}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setRegenAllOpen(false)}
            disabled={regenAllLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => { void handleConfirmRegenerateAll() }}
            loading={regenAllLoading}
          >
            {t('project.regenAllConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
