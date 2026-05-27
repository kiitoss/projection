import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/layout/Header'
import { TabBar } from '@/components/tabs/TabBar'
import { AddTabModal } from '@/components/tabs/AddTabModal'
import { DescriptionTab } from '@/components/tabs/DescriptionTab'
import { TodoTab } from '@/components/tabs/TodoTab'
import { ChaosTab } from '@/components/tabs/ChaosTab'
import { DigestTab } from '@/components/tabs/DigestTab'
import { WidgetsTab } from '@/components/tabs/WidgetsTab'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TagPill } from '@/components/ui/TagPill'
import { useProject } from '@/hooks/useProject'
import type { TabType } from '@/types'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const {
    project, tabs, loading,
    updateProject, addTab, updateTab, deleteTab, reorderTabs,
    addLink, deleteLink,
  } = useProject(id!)
  const { t } = useTranslation()

  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [addTabOpen, setAddTabOpen] = useState(false)
  const [confirmDeleteTab, setConfirmDeleteTab] = useState<string | null>(null)

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

  const tabToDelete = tabs.find((tab) => tab.id === confirmDeleteTab)

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <Header />

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
        {project.tags.length > 0 && (
          <div className="flex gap-1.5 shrink-0">
            {project.tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>
        )}
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

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        {activeTab?.type === 'description' && (
          <DescriptionTab
            project={project}
            onUpdate={updateProject}
            onAddLink={addLink}
            onDeleteLink={deleteLink}
          />
        )}
        {activeTab?.type === 'todo' && (
          <TodoTab
            tab={activeTab}
            onUpdateTab={(updates) => updateTab(activeTab.id, updates)}
          />
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
    </div>
  )
}
