import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/layout/Header'
import { TabBar } from '@/components/tabs/TabBar'
import { AddTabModal } from '@/components/tabs/AddTabModal'
import { DescriptionTab } from '@/components/tabs/DescriptionTab'
import { TodoList } from '@/components/tabs/TodoList'
import { ChaosTab } from '@/components/tabs/ChaosTab'
import { DigestTab } from '@/components/tabs/DigestTab'
import { WidgetsTab } from '@/components/tabs/WidgetsTab'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TagPill } from '@/components/ui/TagPill'
import { useProject } from '@/hooks/useProject'
import { useTags } from '@/hooks/useTags'
import { supabase } from '@/lib/supabase'
import { generateWithGemini, buildProjectContext } from '@/lib/gemini'
import { toast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import type { TabType, Widget, DigestTabConfig } from '@/types'

interface RegenAllItems {
  digestTabs: Array<{ tabId: string; chaosTabIds: string[]; prompt: string }>
  widgets: Widget[]
}

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const {
    project, tabs, loading,
    updateProject, addTab, updateTab, deleteTab, reorderTabs,
    addLink, deleteLink, addTagToProject, removeTagFromProject,
  } = useProject(id!)
  const { tags: allTags } = useTags()
  const { t } = useTranslation()

  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [addTabOpen, setAddTabOpen] = useState(false)
  const [confirmDeleteTab, setConfirmDeleteTab] = useState<string | null>(null)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [regenAllOpen, setRegenAllOpen] = useState(false)
  const [regenAllLoading, setRegenAllLoading] = useState(false)
  const [regenCheckLoading, setRegenCheckLoading] = useState(false)
  const [regenAllItems, setRegenAllItems] = useState<RegenAllItems | null>(null)
  const [regenProgress, setRegenProgress] = useState<{ current: number; total: number } | null>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const activeTab = activeTabId
    ? tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
    : tabs[0]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Spinner size="lg" className="text-indigo-500" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-4">
        <p className="text-slate-500">{t('project.notFound')}</p>
        <Link to="/" className="text-sm text-indigo-500 hover:underline">{t('project.backLink')}</Link>
      </div>
    )
  }

  async function handleAddTab(type: TabType, title: string, config: Record<string, unknown>) {
    const tab = await addTab(type, title, config)
    if (tab) setActiveTabId(tab.id)
  }

  async function handleDeleteTab(tabId: string) {
    await deleteTab(tabId)
    if (activeTab?.id === tabId) {
      setActiveTabId(tabs.find((tab) => tab.id !== tabId)?.id ?? null)
    }
    setConfirmDeleteTab(null)
  }

  async function handleClickRegenerateAll() {
    setRegenCheckLoading(true)

    const chaosTabs = tabs.filter((t) => t.type === 'chaos')
    const digestTabs = tabs.filter((t) => t.type === 'digest')
    const widgetsTabs = tabs.filter((t) => t.type === 'widgets')

    // Fetch chaos content updated_at for all chaos tabs
    const chaosContentsMap: { tab_id: string; updated_at: string }[] = []
    if (chaosTabs.length) {
      const { data } = await supabase
        .from('chaos_content')
        .select('tab_id, updated_at')
        .in('tab_id', chaosTabs.map((t) => t.id))
      chaosContentsMap.push(...((data as { tab_id: string; updated_at: string }[]) ?? []))
    }

    const chaosMaxUpdatedAt = chaosContentsMap.length
      ? new Date(Math.max(...chaosContentsMap.map((r) => new Date(r.updated_at).getTime())))
      : null

    // Find stale digest tabs
    const staleDigestTabs: RegenAllItems['digestTabs'] = []
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
          chaosTabIds,
          prompt: (config?.prompt as string) ?? t('digestTab.defaultPrompt'),
        })
      }
    }

    // Find stale widgets
    const staleWidgets: Widget[] = []
    if (widgetsTabs.length) {
      const { data: allWidgets } = await supabase
        .from('widgets')
        .select('*')
        .in('tab_id', widgetsTabs.map((t) => t.id))

      for (const widget of (allWidgets as Widget[]) ?? []) {
        const isStale =
          !widget.last_generated_at ||
          (chaosMaxUpdatedAt && chaosMaxUpdatedAt > new Date(widget.last_generated_at))
        if (isStale) staleWidgets.push(widget)
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

    // Regenerate stale digests
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

    // Regenerate stale widgets
    if (regenAllItems.widgets.length > 0) {
      try {
        const chaosTabs = tabs.filter((t) => t.type === 'chaos')
        const chaosContents: { title: string; content: string }[] = []

        if (chaosTabs.length) {
          const { data: chaosRows } = await supabase
            .from('chaos_content')
            .select('content, tab_id')
            .in('tab_id', chaosTabs.map((t) => t.id))

          for (const row of (chaosRows as { content: string; tab_id: string }[]) ?? []) {
            const tabTitle = chaosTabs.find((t) => t.id === row.tab_id)?.title ?? 'Chaos'
            chaosContents.push({ title: tabTitle, content: row.content })
          }
        }

        const context = buildProjectContext({
          projectName: project!.name,
          longDescription: project!.long_description,
          keyPoints: project!.key_points,
          chaosContents,
          todos: [],
        })

        const now = new Date().toISOString()
        for (const widget of regenAllItems.widgets) {
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

  const tabToDelete = tabs.find((tab) => tab.id === confirmDeleteTab)

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <Header
        onRegenerateAll={handleClickRegenerateAll}
        regenerateLoading={regenCheckLoading}
      />

      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
        >
          <ChevronLeft size={16} />
          {t('project.breadcrumb')}
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {project.name}
        </h1>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {project.tags.map((tag) => (
            <div key={tag.id} className="group relative flex items-center">
              <TagPill tag={tag} />
              <button
                onClick={() => removeTagFromProject(tag.id)}
                className="absolute -top-1 -right-1 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-600 text-white cursor-pointer"
                title="Retirer le tag"
              >
                <X size={8} />
              </button>
            </div>
          ))}

          <div ref={tagPickerRef} className="relative">
            <button
              onClick={() => setTagPickerOpen((o) => !o)}
              className="flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <Plus size={10} />
              Tag
            </button>

            {tagPickerOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
                {allTags.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Aucun tag disponible</p>
                ) : (
                  allTags.map((tag) => {
                    const isOnProject = project.tags.some((t) => t.id === tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => {
                          if (isOnProject) removeTagFromProject(tag.id)
                          else addTagToProject(tag.id)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer',
                          isOnProject
                            ? 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
                        )}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-left">{tag.name}</span>
                        {isOnProject && <X size={10} className="shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <TabBar
        tabs={tabs}
        activeTabId={activeTab?.id ?? null}
        onSelectTab={setActiveTabId}
        onAddTab={() => setAddTabOpen(true)}
        onRenameTab={(tabId, title) => updateTab(tabId, { title })}
        onDeleteTab={async (tabId) => setConfirmDeleteTab(tabId)}
        onReorderTabs={reorderTabs}
      />

      <div className={cn(
        'flex-1 bg-slate-50 dark:bg-slate-900',
        activeTab?.type === 'description'
          ? 'overflow-y-auto md:overflow-hidden flex flex-col md:flex-row'
          : 'overflow-y-auto',
      )}>
        {activeTab?.type === 'description' && (
          <>
            <div className="md:flex-1 md:overflow-y-auto border-b border-slate-200 dark:border-slate-700 md:border-b-0 md:border-r">
              <DescriptionTab
                project={project}
                onUpdate={updateProject}
                onAddLink={addLink}
                onDeleteLink={deleteLink}
                className="w-full"
              />
            </div>
            <div className="md:flex-1 md:overflow-y-auto">
              <TodoList
                tab={activeTab}
                onUpdateTab={(updates) => updateTab(activeTab.id, updates)}
                className="w-full"
              />
            </div>
          </>
        )}
        {activeTab?.type === 'chaos' && (
          <ChaosTab tab={activeTab} />
        )}
        {activeTab?.type === 'digest' && (
          <DigestTab
            tab={activeTab}
            onUpdateTab={(updates) => updateTab(activeTab.id, updates)}
          />
        )}
        {activeTab?.type === 'widgets' && project && (
          <WidgetsTab tab={activeTab} project={project} />
        )}
        {!activeTab && (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">
            {t('project.selectTab')}
          </div>
        )}
      </div>

      <AddTabModal
        open={addTabOpen}
        onClose={() => setAddTabOpen(false)}
        onAdd={handleAddTab}
        existingTabs={tabs}
      />

      <ConfirmDialog
        open={!!confirmDeleteTab}
        onClose={() => setConfirmDeleteTab(null)}
        onConfirm={() => handleDeleteTab(confirmDeleteTab!)}
        title={t('project.deleteTabTitle', { title: tabToDelete?.title })}
        description={t('project.deleteTabDescription')}
        confirmLabel={t('common.delete')}
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
